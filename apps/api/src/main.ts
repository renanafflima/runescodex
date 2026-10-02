import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { corsOptions } from './common/cors';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors(corsOptions());
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
