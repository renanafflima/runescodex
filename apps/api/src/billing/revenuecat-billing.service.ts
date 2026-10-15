import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService, type PremiumView } from './billing.service';
import { RevenueCatClient } from './revenuecat.client';

type RevenueCatWebhookBody = {
  event?: {
    app_user_id?: unknown;
  };
};

function sameSecret(actual: string | undefined, expected: string) {
  if (!actual) {
    return false;
  }
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class RevenueCatBillingService {
  private readonly logger = new Logger(RevenueCatBillingService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly revenueCat: RevenueCatClient,
    private readonly prisma: PrismaService,
  ) {}

  async sync(userId: string): Promise<PremiumView> {
    const active = await this.revenueCat.hasActivePremium(userId);
    return this.billing.syncStoreEntitlement(userId, active);
  }

  async handleWebhook(authorization: string | undefined, body: unknown) {
    const expected = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'RevenueCat webhook is not configured',
      );
    }
    if (!sameSecret(authorization, expected)) {
      throw new UnauthorizedException('Invalid RevenueCat webhook');
    }

    const payload =
      typeof body === 'object' && body !== null
        ? (body as RevenueCatWebhookBody)
        : undefined;
    const appUserId = payload?.event?.app_user_id;
    if (typeof appUserId !== 'string' || !appUserId.trim()) {
      throw new UnauthorizedException('Invalid RevenueCat event');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: appUserId.trim() },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn('Ignoring RevenueCat event for an unknown app user');
      return { received: true };
    }

    await this.sync(user.id);
    return { received: true };
  }
}
