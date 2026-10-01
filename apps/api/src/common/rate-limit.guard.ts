import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  scope: 'ip' | 'user';
};

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext) {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      user?: { userId?: string };
      socket?: { remoteAddress?: string };
    }>();
    const actor =
      options.scope === 'user' && request.user?.userId
        ? request.user.userId
        : request.ip || request.socket?.remoteAddress || 'unknown';
    const key = `${context.getClass().name}:${context.getHandler().name}:${actor}`;
    this.rateLimit.consume(key, options.limit, options.windowMs);
    return true;
  }
}
