import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function resolvePort(): number {
  const raw = process.env.PORT;
  if (!raw) {
    return 3000;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    return 3000;
  }

  return port;
}

function resolveCorsOrigin(): boolean | string[] {
  const configured = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return process.env.NODE_ENV === 'production' ? false : true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: resolveCorsOrigin(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = resolvePort();
  await app.listen(port, '0.0.0.0');
  Logger.log(`Listening on port ${port}`);
}
bootstrap();
