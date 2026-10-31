import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MERCADO_PAGO_PROVIDER,
  PREMIUM_PRODUCT_CODE,
} from '../../billing/billing.constants';
import { MercadoPagoClient } from '../../billing/mercado-pago.client';
import { PrismaService } from '../../prisma/prisma.service';

export type MercadoPagoAdminDiagnosticView = {
  temporary: true;
  collectorId: number;
  pixPaymentMethods: Array<{
    id: string;
    payment_type_id: string;
    status: string;
  }>;
  latestPreference: {
    preferenceId: string;
    collectorId: number | null;
    matchesAuthenticatedCollector: boolean;
  } | null;
  reusablePendingCheckouts: number;
  productionCheckoutMode: boolean;
};

function diagnosticEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC?.trim().toLowerCase() ===
    'true';
}

@Injectable()
export class AdminMercadoPagoDiagnosticService {
  constructor(
    private readonly mercadoPago: MercadoPagoClient,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled() {
    return diagnosticEnabled();
  }

  async run(): Promise<MercadoPagoAdminDiagnosticView> {
    if (!this.isEnabled()) {
      throw new NotFoundException();
    }
    if (!this.mercadoPago.config()) {
      throw new ServiceUnavailableException(
        'Mercado Pago billing is not configured',
      );
    }

    const [collectorId, pixPaymentMethods, latestPreferenceId, reusablePendingCheckouts] =
      await Promise.all([
        this.mercadoPago.getAuthenticatedCollectorId(),
        this.mercadoPago.listPixPaymentMethods(),
        this.findLatestPreferenceId(),
        this.countReusablePendingCheckouts(),
      ]);

    let latestPreference: MercadoPagoAdminDiagnosticView['latestPreference'] =
      null;
    if (latestPreferenceId) {
      const preferenceCollectorId =
        await this.mercadoPago.getPreferenceCollectorId(latestPreferenceId);
      latestPreference = {
        preferenceId: latestPreferenceId,
        collectorId: preferenceCollectorId,
        matchesAuthenticatedCollector:
          preferenceCollectorId != null &&
          preferenceCollectorId === collectorId,
      };
    }

    const config = this.mercadoPago.config();
    return {
      temporary: true,
      collectorId,
      pixPaymentMethods,
      latestPreference,
      reusablePendingCheckouts,
      productionCheckoutMode: config ? !config.sandbox : false,
    };
  }

  private async findLatestPreferenceId(): Promise<string | null> {
    const payment = await this.prisma.billingPayment.findFirst({
      where: {
        provider: MERCADO_PAGO_PROVIDER,
        providerCheckoutId: { not: null },
        order: {
          product: { code: PREMIUM_PRODUCT_CODE },
          market: 'BR',
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { providerCheckoutId: true },
    });
    const id = payment?.providerCheckoutId?.trim() ?? '';
    return id || null;
  }

  /** Same criteria as BillingService.findOpenCheckout, counted across all users. */
  private async countReusablePendingCheckouts(): Promise<number> {
    return this.prisma.billingPayment.count({
      where: {
        status: 'PENDING',
        checkoutUrl: { not: null },
        order: {
          status: 'PENDING',
          market: 'BR',
          product: { code: PREMIUM_PRODUCT_CODE },
        },
      },
    });
  }
}

export { diagnosticEnabled };
