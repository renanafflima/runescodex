import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminGuard } from '../admin.guard';
import { AdminDatabaseMigrationDiagnosticController } from './admin-database-migration-diagnostic.controller';
import { AdminDatabaseMigrationDiagnosticService } from './admin-database-migration-diagnostic.service';

jest.mock('@nestjs/passport', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const common = require('@nestjs/common') as typeof import('@nestjs/common');
  return {
    AuthGuard: () =>
      class {
        canActivate(context: {
          switchToHttp(): {
            getRequest(): {
              headers: { authorization?: string };
              user?: {
                userId: string;
                email: string;
                sessionId: string;
              };
            };
          };
        }) {
          const request = context.switchToHttp().getRequest();
          const authorization = request.headers.authorization;
          if (!authorization) {
            throw new common.UnauthorizedException();
          }
          request.user = {
            userId: authorization.endsWith('admin') ? 'admin-1' : 'user-1',
            email: 'a@example.com',
            sessionId: 'session-1',
          };
          return true;
        }
      },
  };
});

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminDatabaseMigrationDiagnosticController', () => {
  const diagnostic = {
    run: jest.fn().mockResolvedValue({
      temporary: true,
      appEnv: 'production',
      database: { host: 'db.example', port: 5432, name: 'runescodex' },
    }),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({
          role: where.id === 'admin-1' ? 'ADMIN' : 'USER',
        }),
      ),
    },
  };

  it('protects the controller with JwtAuthGuard and AdminGuard', () => {
    const metadata: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminDatabaseMigrationDiagnosticController,
    );
    expect(metadata).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
  });

  it('returns 401, 403, and 200 according to the session role', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminDatabaseMigrationDiagnosticController],
      providers: [
        {
          provide: AdminDatabaseMigrationDiagnosticService,
          useValue: diagnostic,
        },
        AdminGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    const http = request(app.getHttpServer() as App);
    const path = '/admin/system/database-migration-diagnostic';

    await http.get(path).expect(401);
    await http.get(path).set('Authorization', 'Bearer user').expect(403);
    const allowed = await http
      .get(path)
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(diagnostic.run).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(allowed.body)).not.toMatch(
      /postgresql:\/\/|password|DATABASE_URL/,
    );

    await app.close();
  });
});
