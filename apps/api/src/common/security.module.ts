import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { SafeExceptionFilter } from './safe-exception.filter';

@Global()
@Module({
  providers: [
    RateLimitService,
    RateLimitGuard,
    {
      provide: APP_FILTER,
      useClass: SafeExceptionFilter,
    },
  ],
  exports: [RateLimitGuard, RateLimitService],
})
export class SecurityModule {}
