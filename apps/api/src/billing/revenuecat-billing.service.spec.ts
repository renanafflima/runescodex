import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService, inactivePremium } from './billing.service';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { RevenueCatClient } from './revenuecat.client';

describe('RevenueCatBillingService', () => {
  const billing = {
    syncStoreEntitlement: jest.fn(),
  };
  const revenueCat = {
    hasActivePremium: jest.fn(),
  };
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const service = new RevenueCatBillingService(
    billing as unknown as BillingService,
    revenueCat as unknown as RevenueCatClient,
    prisma as unknown as PrismaService,
  );
  const originalWebhookAuthorization =
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    revenueCat.hasActivePremium.mockResolvedValue(false);
    billing.syncStoreEntitlement.mockResolvedValue(inactivePremium());
  });

  afterAll(() => {
    if (originalWebhookAuthorization === undefined) {
      delete process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    } else {
      process.env.REVENUECAT_WEBHOOK_AUTHORIZATION =
        originalWebhookAuthorization;
    }
  });

  it('synchronizes the authenticated app user against RevenueCat', async () => {
    await service.sync('account-1');

    expect(revenueCat.hasActivePremium).toHaveBeenCalledWith('account-1');
    expect(billing.syncStoreEntitlement).toHaveBeenCalledWith(
      'account-1',
      false,
    );
  });

  it('requires the configured authorization header for webhooks', async () => {
    await expect(
      service.handleWebhook('wrong-secret', {
        event: { app_user_id: 'account-1' },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();

    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = 'webhook-secret';
    await expect(
      service.handleWebhook('wrong-secret', {
        event: { app_user_id: 'account-1' },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechecks the RevenueCat customer rather than trusting webhook purchase data', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = 'webhook-secret';
    prisma.user.findUnique.mockResolvedValue({ id: 'account-1' });

    await expect(
      service.handleWebhook('webhook-secret', {
        event: { app_user_id: 'account-1' },
      }),
    ).resolves.toEqual({ received: true });

    expect(revenueCat.hasActivePremium).toHaveBeenCalledWith('account-1');
    expect(billing.syncStoreEntitlement).toHaveBeenCalledWith(
      'account-1',
      false,
    );
  });

  it('ignores unknown RevenueCat app user ids without granting access', async () => {
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION = 'webhook-secret';
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.handleWebhook('webhook-secret', {
        event: { app_user_id: 'anonymous-id' },
      }),
    ).resolves.toEqual({ received: true });

    expect(revenueCat.hasActivePremium).not.toHaveBeenCalled();
    expect(billing.syncStoreEntitlement).not.toHaveBeenCalled();
  });
});
