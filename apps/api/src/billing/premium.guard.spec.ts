import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService, inactivePremium } from './billing.service';
import { PremiumGuard } from './premium.guard';

describe('PremiumGuard', () => {
  const billing = {
    getPremium: jest.fn(),
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  function context(userId?: string) {
    return {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { userId } : undefined }),
      }),
    };
  }

  let guard: PremiumGuard;

  beforeEach(() => {
    billing.getPremium.mockReset();
    reflector.getAllAndOverride.mockReturnValue(false);
    guard = new PremiumGuard(
      billing as unknown as BillingService,
      reflector as unknown as Reflector,
    );
  });

  it('blocks an authenticated user without an active license', async () => {
    billing.getPremium.mockResolvedValue(inactivePremium());

    await expect(
      guard.canActivate(context('user-1') as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an authenticated user with an active license', async () => {
    billing.getPremium.mockResolvedValue({
      ...inactivePremium(),
      access: true,
      licenseStatus: 'ACTIVE',
      paymentStatus: 'PAID',
    });

    await expect(guard.canActivate(context('user-1') as never)).resolves.toBe(
      true,
    );
  });

  it('does not treat a missing session as premium access', async () => {
    await expect(guard.canActivate(context() as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(billing.getPremium).not.toHaveBeenCalled();
  });
});
