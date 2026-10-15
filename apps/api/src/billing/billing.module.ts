import { Global, Module } from '@nestjs/common';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MercadoPagoClient } from './mercado-pago.client';
import { PremiumGuard } from './premium.guard';
import { RevenueCatBillingService } from './revenuecat-billing.service';
import { RevenueCatClient } from './revenuecat.client';

@Global()
@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingCheckoutService,
    RevenueCatBillingService,
    RevenueCatClient,
    MercadoPagoClient,
    PremiumGuard,
  ],
  exports: [BillingService, PremiumGuard],
})
export class BillingModule {}
