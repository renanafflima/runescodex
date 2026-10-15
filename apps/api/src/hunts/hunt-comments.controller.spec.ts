import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from '../billing/billing.service';
import { PremiumGuard } from '../billing/premium.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { HuntCommentsController } from './hunt-comments.controller';
import { HuntCommentsService } from './hunt-comments.service';

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

const COMMENT_ID = '11111111-1111-4111-8111-111111111111';

function readGuards(target: object): unknown[] {
  const metadata: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(metadata) ? metadata : [];
}

function handler(name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(
    HuntCommentsController.prototype,
    name,
  )?.value;
  if (typeof value !== 'function') {
    throw new Error(`Missing handler ${name}`);
  }
  return value;
}

describe('HuntCommentsController auth', () => {
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], commentCount: 0 }),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
  };

  it('requires a premium session to read or write comments', () => {
    expect(readGuards(HuntCommentsController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, PremiumGuard]),
    );
    expect(readGuards(handler('list'))).toEqual([]);
    for (const name of ['create', 'update', 'remove', 'like', 'unlike']) {
      expect(readGuards(handler(name))).toEqual(
        expect.arrayContaining([JwtAuthGuard, RateLimitGuard]),
      );
    }
  });

  it('rejects comment routes without authentication', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HuntCommentsController],
      providers: [
        { provide: HuntCommentsService, useValue: service },
        { provide: BillingService, useValue: { getPremium: jest.fn() } },
        PremiumGuard,
        RateLimitService,
        RateLimitGuard,
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

    await http.get('/hunts/cyclops/comments').expect(401);
    expect(service.list).not.toHaveBeenCalled();

    await http
      .post('/hunts/cyclops/comments')
      .send({ content: 'Olá' })
      .expect(401);
    await http
      .patch(`/hunts/cyclops/comments/${COMMENT_ID}`)
      .send({ content: 'Olá' })
      .expect(401);
    await http.delete(`/hunts/cyclops/comments/${COMMENT_ID}`).expect(401);
    await http.post(`/hunts/cyclops/comments/${COMMENT_ID}/like`).expect(401);
    await http.delete(`/hunts/cyclops/comments/${COMMENT_ID}/like`).expect(401);

    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
    expect(service.like).not.toHaveBeenCalled();
    expect(service.unlike).not.toHaveBeenCalled();

    await app.close();
  });
});
