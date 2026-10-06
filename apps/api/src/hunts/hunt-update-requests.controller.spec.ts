import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { RateLimitService } from '../common/rate-limit.service';
import { HuntUpdateRequestsController } from './hunt-update-requests.controller';
import { HuntUpdateRequestsService } from './hunt-update-requests.service';

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

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function readGuards(target: object): unknown[] {
  const metadata: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(metadata) ? metadata : [];
}

function handler(name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(
    HuntUpdateRequestsController.prototype,
    name,
  )?.value;
  if (typeof value !== 'function') {
    throw new Error(`Missing handler ${name}`);
  }
  return value;
}

describe('HuntUpdateRequestsController auth', () => {
  const service = {
    list: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  it('requires a session to read or create update requests', () => {
    expect(readGuards(handler('list'))).toEqual(
      expect.arrayContaining([JwtAuthGuard]),
    );
    expect(readGuards(handler('findOne'))).toEqual(
      expect.arrayContaining([JwtAuthGuard]),
    );
    expect(readGuards(handler('create'))).toEqual(
      expect.arrayContaining([JwtAuthGuard, RateLimitGuard]),
    );
  });

  it('rejects every route without authentication', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HuntUpdateRequestsController],
      providers: [
        { provide: HuntUpdateRequestsService, useValue: service },
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

    await http.get('/hunts/cyclops/update-requests').expect(401);
    await http.get(`/hunts/cyclops/update-requests/${REQUEST_ID}`).expect(401);
    await http
      .post('/hunts/cyclops/update-requests')
      .send({
        type: 'XP',
        description: 'O XP dessa hunt está desatualizado.',
      })
      .expect(401);

    expect(service.list).not.toHaveBeenCalled();
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();

    await app.close();
  });
});
