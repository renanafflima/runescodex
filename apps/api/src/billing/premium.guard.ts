import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService } from './billing.service';

export const SKIP_PREMIUM_KEY = 'skipPremium';

export const SkipPremium = () => SetMetadata(SKIP_PREMIUM_KEY, true);

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private readonly billing: BillingService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PREMIUM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { userId?: string };
    }>();
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const premium = await this.billing.getPremium(userId);
    if (!premium.access) {
      throw new ForbiddenException('Premium required');
    }
    return true;
  }
}
