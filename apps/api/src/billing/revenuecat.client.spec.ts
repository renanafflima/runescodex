import { ServiceUnavailableException } from '@nestjs/common';
import { RevenueCatClient } from './revenuecat.client';

describe('RevenueCatClient', () => {
  const client = new RevenueCatClient();
  const originalApiKey = process.env.REVENUECAT_SECRET_API_KEY;

  beforeEach(() => {
    process.env.REVENUECAT_SECRET_API_KEY = 'sk_test_secret';
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.REVENUECAT_SECRET_API_KEY;
    } else {
      process.env.REVENUECAT_SECRET_API_KEY = originalApiKey;
    }
    jest.restoreAllMocks();
  });

  it('accepts only an active RevenueCat premium entitlement', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          subscriber: {
            entitlements: {
              premium: { expires_date: null },
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(client.hasActivePremium('account-1')).resolves.toBe(true);
  });

  it('rejects expired entitlements and handles users without a subscriber', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            subscriber: {
              entitlements: {
                premium: { expires_date: '2000-01-01T00:00:00Z' },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(client.hasActivePremium('account-1')).resolves.toBe(false);
    await expect(client.hasActivePremium('new-account')).resolves.toBe(false);
  });

  it('fails closed when the secret API key is missing', async () => {
    delete process.env.REVENUECAT_SECRET_API_KEY;

    await expect(client.hasActivePremium('account-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed on RevenueCat API errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 401 }));

    await expect(client.hasActivePremium('account-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
