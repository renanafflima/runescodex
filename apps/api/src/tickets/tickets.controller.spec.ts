import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

jest.mock('@nestjs/passport', () => {
  // Jest hoists this factory above imports, so the exception class is loaded here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const common = require('@nestjs/common') as typeof import('@nestjs/common');
  return {
    AuthGuard: () =>
      class {
        canActivate(): never {
          throw new common.UnauthorizedException();
        }
      },
  };
});

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function readGuards(target: object): unknown[] {
  const metadata: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(metadata) ? metadata : [];
}

describe('TicketsController auth', () => {
  it('requires authentication on every ticket route', () => {
    expect(readGuards(TicketsController)).toEqual(
      expect.arrayContaining([JwtAuthGuard]),
    );
  });

  it('requires admin to change status', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      TicketsController.prototype,
      'updateStatus',
    )?.value;
    expect(readGuards(handler as object)).toEqual(
      expect.arrayContaining([AdminGuard]),
    );
  });

  it('rejects ticket creation without authentication', async () => {
    const create = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: { create },
        },
        RateLimitService,
        RateLimitGuard,
        AdminGuard,
        { provide: PrismaService, useValue: {} },
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

    await request(app.getHttpServer() as App)
      .post('/tickets')
      .send({
        problemType: 'OTHER',
        impact: 'LOW',
        origin: 'GENERAL',
        description: 'Unauthenticated',
      })
      .expect(401);

    expect(create).not.toHaveBeenCalled();

    await request(app.getHttpServer() as App)
      .post('/tickets/66666666-6666-4666-8666-666666666666/evidence')
      .expect(401);

    await app.close();
  });
});
