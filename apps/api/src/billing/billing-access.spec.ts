jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class AuthGuard {},
}));

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminDashboardController } from '../admin/admin-dashboard.controller';
import { AdminLicensesController } from '../admin/licenses/admin-licenses.controller';
import { HuntUpdateRequestsAdminController } from '../admin/hunt-update-requests-admin.controller';
import { RewardsAdminController } from '../admin/rewards-admin.controller';
import { AppController } from '../app.controller';
import { AuthController } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BestiaryController } from '../bestiary/bestiary.controller';
import { CharactersController } from '../characters/characters.controller';
import { ForumController } from '../forum/forum.controller';
import { HuntCommentsController } from '../hunts/hunt-comments.controller';
import { HuntUpdateRequestsController } from '../hunts/hunt-update-requests.controller';
import { HuntsController } from '../hunts/hunts.controller';
import { RewardsController } from '../rewards/rewards.controller';
import { TicketsController } from '../tickets/tickets.controller';
import { AdminGuard } from '../admin/admin.guard';
import { AdminMercadoPagoDiagnosticController } from '../admin/billing/admin-mercado-pago-diagnostic.controller';
import { BillingController } from './billing.controller';
import { PremiumGuard, SKIP_PREMIUM_KEY } from './premium.guard';

function guardsOf(target: object): unknown[] {
  const metadata: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(metadata) ? metadata : [];
}

function handler(controller: { prototype: object }, name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(
    controller.prototype,
    name,
  )?.value;
  if (typeof value !== 'function') {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

describe('Premium access on API routes', () => {
  const premiumControllers = [
    HuntsController,
    HuntCommentsController,
    HuntUpdateRequestsController,
    BestiaryController,
    ForumController,
    RewardsController,
    CharactersController,
    TicketsController,
  ];

  it('requires premium on product endpoints', () => {
    for (const controller of premiumControllers) {
      expect(guardsOf(controller)).toEqual(
        expect.arrayContaining([JwtAuthGuard, PremiumGuard]),
      );
    }
  });

  it('leaves home, auth, checkout and the webhook outside the premium guard', () => {
    expect(guardsOf(AppController)).not.toContain(PremiumGuard);
    expect(guardsOf(handler(AuthController, 'register'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(AuthController, 'login'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(AuthController, 'me'))).not.toContain(PremiumGuard);
    expect(guardsOf(handler(AuthController, 'me'))).toContain(JwtAuthGuard);
    expect(guardsOf(handler(BillingController, 'start'))).toContain(
      JwtAuthGuard,
    );
    expect(guardsOf(handler(BillingController, 'start'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(BillingController, 'refresh'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(BillingController, 'syncRevenueCat'))).toContain(
      JwtAuthGuard,
    );
    expect(guardsOf(handler(BillingController, 'webhook'))).not.toContain(
      JwtAuthGuard,
    );
    expect(
      guardsOf(handler(BillingController, 'revenueCatWebhook')),
    ).not.toContain(JwtAuthGuard);
    expect(guardsOf(handler(BillingController, 'webhook'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(BillingController, 'license'))).toContain(
      JwtAuthGuard,
    );
    expect(guardsOf(handler(BillingController, 'license'))).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(BillingController, 'redeem'))).toContain(
      JwtAuthGuard,
    );
    expect(guardsOf(handler(BillingController, 'redeem'))).not.toContain(
      PremiumGuard,
    );
  });

  it('keeps administrative routes behind admin permission', () => {
    expect(guardsOf(RewardsAdminController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
    expect(guardsOf(RewardsAdminController)).not.toContain(PremiumGuard);
    expect(guardsOf(HuntUpdateRequestsAdminController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
    expect(guardsOf(HuntUpdateRequestsAdminController)).not.toContain(
      PremiumGuard,
    );
    expect(guardsOf(handler(TicketsController, 'updateStatus'))).toContain(
      AdminGuard,
    );
    expect(
      Reflect.getMetadata(
        SKIP_PREMIUM_KEY,
        handler(TicketsController, 'updateStatus'),
      ),
    ).toBe(true);
    expect(guardsOf(AdminDashboardController)).not.toContain(PremiumGuard);
    expect(guardsOf(AdminLicensesController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
    expect(guardsOf(AdminLicensesController)).not.toContain(PremiumGuard);
    expect(guardsOf(AdminMercadoPagoDiagnosticController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, AdminGuard]),
    );
    expect(guardsOf(AdminMercadoPagoDiagnosticController)).not.toContain(
      PremiumGuard,
    );
  });
});

describe('Mobile routes stay behind the premium gate', () => {
  const appDir = join(__dirname, '..', '..', '..', 'mobile', 'app');

  function files(dir: string, prefix = ''): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) {
        return files(full, relative);
      }
      return [relative.replaceAll('\\', '/')];
    });
  }

  it('classifies every screen as public or inside the protected tabs group', () => {
    const publicScreens = new Set([
      '_layout.tsx',
      'index.js',
      'checkout.js',
      '(auth)/_layout.tsx',
      '(auth)/login.js',
      '(auth)/register.js',
      '(tabs)/_layout.tsx',
    ]);
    const found = files(appDir);
    const unexpected = found.filter(
      (file) => !publicScreens.has(file) && !file.startsWith('(tabs)/'),
    );
    expect(unexpected).toEqual([]);
    expect(found).toContain('checkout.js');
    expect(found).toContain('(tabs)/_layout.tsx');
    expect(
      found.some(
        (file) => file.startsWith('(tabs)/') && file !== '(tabs)/_layout.tsx',
      ),
    ).toBe(true);
  });
});
