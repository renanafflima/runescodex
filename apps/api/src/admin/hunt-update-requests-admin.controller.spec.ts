import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { HuntUpdateRequestsAdminController } from './hunt-update-requests-admin.controller';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';

jest.mock('@nestjs/passport', () => {
  // Jest hoists this factory above imports, so the exception class is loaded here.
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

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

describe('HuntUpdateRequestsAdminController', () => {
  const service = {
    list: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    }),
    findOne: jest.fn(),
    update: jest.fn(),
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

  it('protects the controller with the existing admin guards', () => {
    const metadata: unknown = Reflect.getMetadata(
      GUARDS_METADATA,
      HuntUpdateRequestsAdminController,
    );
    expect(metadata).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
  });

  it('returns 401, 403, and 200 according to the session role', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HuntUpdateRequestsAdminController],
      providers: [
        { provide: HuntUpdateRequestsAdminService, useValue: service },
        AdminGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    const http = request(app.getHttpServer() as App);

    await http.get('/admin/hunt-update-requests').expect(401);
    await http
      .get('/admin/hunt-update-requests')
      .set('Authorization', 'Bearer user')
      .expect(403);
    await http
      .get('/admin/hunt-update-requests')
      .set('Authorization', 'Bearer admin')
      .expect(200);

    expect(service.list).toHaveBeenCalledTimes(1);

    await http
      .patch(`/admin/hunt-update-requests/${REQUEST_ID}`)
      .set('Authorization', 'Bearer admin')
      .send({
        status: 'IN_REVIEW',
        userId: 'attacker',
        huntId: 'hunt-1',
        resolvedAt: '2026-10-05T12:00:00.000Z',
      })
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();

    await app.close();
  });
});
