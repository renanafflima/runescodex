import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { corsOptions, resolveCorsOrigins } from './cors';

@Controller('hunts')
class HuntsCorsStub {
  @Get()
  list() {
    return [];
  }
}

@Controller('bestiary')
class BestiaryCorsStub {
  @Get()
  list() {
    return [];
  }
}

@Module({
  controllers: [HuntsCorsStub, BestiaryCorsStub],
})
class CorsTestModule {}

describe('CORS for Web/PWA', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(CorsTestModule, {
      logger: false,
    });
    app.enableCors(corsOptions({}));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the required web origins and merges CORS_ORIGINS', () => {
    expect(resolveCorsOrigins({})).toEqual([
      'https://tritec.app.br',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
    expect(
      resolveCorsOrigins({
        CORS_ORIGINS: 'https://extra.example, https://tritec.app.br',
      }),
    ).toEqual([
      'https://tritec.app.br',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'https://extra.example',
    ]);
    expect(corsOptions({}).origin).not.toBe(true);
    expect(corsOptions({}).origin).not.toBe('*');
  });

  it.each([
    'https://tritec.app.br',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ])('answers OPTIONS /hunts for %s', async (origin) => {
    const response = await request(app.getHttpServer())
      .options('/hunts')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toMatch(/GET/);
    expect(response.headers['access-control-allow-headers']).toMatch(
      /authorization/i,
    );
    expect(response.headers['access-control-allow-headers']).toMatch(
      /content-type/i,
    );
  });

  it('does not reflect unknown origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/hunts')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('adds CORS headers to GET /hunts and GET /bestiary', async () => {
    const hunts = await request(app.getHttpServer())
      .get('/hunts')
      .set('Origin', 'https://tritec.app.br');
    const bestiary = await request(app.getHttpServer())
      .get('/bestiary')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(hunts.status).toBe(200);
    expect(hunts.headers['access-control-allow-origin']).toBe(
      'https://tritec.app.br',
    );
    expect(bestiary.status).toBe(200);
    expect(bestiary.headers['access-control-allow-origin']).toBe(
      'http://127.0.0.1:5173',
    );
  });
});
