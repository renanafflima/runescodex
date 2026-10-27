import { Global, Module } from '@nestjs/common';
import { ReferralsModule } from '../referrals/referrals.module';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MercadoPagoClient } from './mercado-pago.client';
import { PremiumGuard } from './premium.guard';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { RevenueCatClient } from './revenuecat.client';
import { PendingLicenseGrantService } from './pending-license-grant.service';
import { VoucherService } from './voucher.service';

@Global()
@Module({
  imports: [ReferralsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingCheckoutService,
    RevenueCatBillingService,
    RevenueCatClient,
    MercadoPagoClient,
    PremiumGuard,
    VoucherService,
    PendingLicenseGrantService,
  ],
  exports: [
    BillingService,
    BillingCheckoutService,
    PremiumGuard,
    PendingLicenseGrantService,
  ],
})
export class BillingModule {}
