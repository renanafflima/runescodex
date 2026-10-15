import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { REVENUECAT_PREMIUM_ENTITLEMENT } from './billing.constants';

type RevenueCatSubscriber = {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null } | undefined>;
  };
};

@Injectable()
export class RevenueCatClient {
  async hasActivePremium(appUserId: string): Promise<boolean> {
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'RevenueCat server integration is not configured',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'RevenueCat verification request failed',
      );
    }

    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'RevenueCat verification request failed',
      );
    }

    let payload: RevenueCatSubscriber;
    try {
      payload = (await response.json()) as RevenueCatSubscriber;
    } catch {
      throw new ServiceUnavailableException(
        'RevenueCat verification response was invalid',
      );
    }

    const entitlement =
      payload.subscriber?.entitlements?.[REVENUECAT_PREMIUM_ENTITLEMENT];
    if (!entitlement) {
      return false;
    }
    if (entitlement.expires_date === null) {
      return true;
    }
    if (typeof entitlement.expires_date !== 'string') {
      return false;
    }
    const expiration = Date.parse(entitlement.expires_date);
    return Number.isFinite(expiration) && expiration > Date.now();
  }
}
