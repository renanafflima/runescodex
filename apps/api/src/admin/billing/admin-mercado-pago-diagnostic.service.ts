import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MERCADO_PAGO_PROVIDER,
  PREMIUM_PRODUCT_CODE,
} from '../../billing/billing.constants';
import {
  MercadoPagoClient,
  type MercadoPagoPixMethodSummary,
} from '../../billing/mercado-pago.client';
import type { MercadoPagoDiagnosticStep } from '../../billing/mercado-pago.diagnostic';
import { PrismaService } from '../../prisma/prisma.service';

export type MercadoPagoAdminDiagnosticView = {
  temporary: true;
  configured: boolean;
  productionCheckoutMode: boolean | null;
  collectorId: number | null;
  pixPaymentMethods: MercadoPagoPixMethodSummary[];
  pixCatalogNote: string;
  latestPreference: {
    preferenceId: string;
    collectorId: number | null;
    matchesAuthenticatedCollector: boolean | null;
  } | null;
  reusablePendingCheckouts: number | null;
  failedSteps: string[];
  steps: MercadoPagoDiagnosticStep[];
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

    const config = this.mercadoPago.config();
    const configStep: MercadoPagoDiagnosticStep<{
      productionCheckoutMode: boolean | null;
    }> = {
      id: 'config',
      ok: Boolean(config),
      httpStatus: null,
      errorCode: config ? null : 'not_configured',
      message: config
        ? null
        : 'Mercado Pago billing is not configured',
      data: {
        productionCheckoutMode: config ? !config.sandbox : null,
      },
    };

    const [usersMe, paymentMethods, latestPreferenceId, reusable] =
      await Promise.all([
        this.safeUsersMe(),
        this.safePaymentMethods(),
        this.safeLatestPreferenceId(),
        this.safeReusableCount(),
      ]);

    const preference = latestPreferenceId.ok
      ? await this.safePreference(
          latestPreferenceId.data,
          usersMe.data?.collectorId ?? null,
        )
      : {
          id: 'latest_preference' as const,
          ok: false,
          httpStatus: null,
          errorCode: latestPreferenceId.errorCode,
          message: latestPreferenceId.message,
          data: null,
        };

    const steps = [
      configStep,
      usersMe,
      paymentMethods,
      preference,
      reusable,
    ];

    return {
      temporary: true,
      configured: Boolean(config),
      productionCheckoutMode: config ? !config.sandbox : null,
      collectorId: usersMe.data?.collectorId ?? null,
      pixPaymentMethods: paymentMethods.data?.pixPaymentMethods ?? [],
      pixCatalogNote:
        'An empty Pix list here does not prove Checkout Pro cannot offer Pix. Confirm the Pix key and Checkout Pro payment types in the Mercado Pago account.',
      latestPreference: preference.data,
      reusablePendingCheckouts: reusable.data?.count ?? null,
      failedSteps: steps.filter((step) => !step.ok).map((step) => step.id),
      steps,
    };
  }

  private async safeUsersMe(): Promise<
    MercadoPagoDiagnosticStep<{ collectorId: number }>
  > {
    try {
      const result = await this.mercadoPago.inspectAuthenticatedCollector();
      return {
        id: 'users_me',
        ok: result.ok,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        message: result.message,
        data: result.data,
      };
    } catch {
      return {
        id: 'users_me',
        ok: false,
        httpStatus: null,
        errorCode: 'unexpected_error',
        message: 'users/me failed unexpectedly',
        data: null,
      };
    }
  }

  private async safePaymentMethods(): Promise<
    MercadoPagoDiagnosticStep<{
      pixPaymentMethods: MercadoPagoPixMethodSummary[];
      paymentMethodCount: number;
    }>
  > {
    try {
      const result = await this.mercadoPago.inspectPixPaymentMethods();
      return {
        id: 'payment_methods',
        ok: result.ok,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        message: result.message,
        data: result.data,
      };
    } catch {
      return {
        id: 'payment_methods',
        ok: false,
        httpStatus: null,
        errorCode: 'unexpected_error',
        message: 'payment_methods failed unexpectedly',
        data: null,
      };
    }
  }

  private async safeLatestPreferenceId(): Promise<
    MercadoPagoDiagnosticStep<string | null>
  > {
    try {
      const preferenceId = await this.findLatestPreferenceId();
      return {
        id: 'latest_preference',
        ok: true,
        httpStatus: null,
        errorCode: null,
        message: preferenceId ? null : 'No Mercado Pago preference is stored',
        data: preferenceId,
      };
    } catch {
      return {
        id: 'latest_preference',
        ok: false,
        httpStatus: null,
        errorCode: 'database_error',
        message: 'Could not read the latest stored preference',
        data: null,
      };
    }
  }

  private async safeReusableCount(): Promise<
    MercadoPagoDiagnosticStep<{ count: number }>
  > {
    try {
      const count = await this.countReusablePendingCheckouts();
      return {
        id: 'reusable_pending_checkouts',
        ok: true,
        httpStatus: null,
        errorCode: null,
        message: null,
        data: { count },
      };
    } catch {
      return {
        id: 'reusable_pending_checkouts',
        ok: false,
        httpStatus: null,
        errorCode: 'database_error',
        message: 'Could not count reusable pending checkouts',
        data: null,
      };
    }
  }

  private async safePreference(
    preferenceId: string | null,
    collectorId: number | null,
  ): Promise<
    MercadoPagoDiagnosticStep<{
      preferenceId: string;
      collectorId: number | null;
      matchesAuthenticatedCollector: boolean | null;
    } | null>
  > {
    if (!preferenceId) {
      return {
        id: 'latest_preference',
        ok: true,
        httpStatus: null,
        errorCode: null,
        message: 'No Mercado Pago preference is stored',
        data: null,
      };
    }
    try {
      const result =
        await this.mercadoPago.inspectPreferenceCollector(preferenceId);
      if (!result.ok) {
        return {
          id: 'latest_preference',
          ok: false,
          httpStatus: result.httpStatus,
          errorCode: result.errorCode,
          message: result.message,
          data: {
            preferenceId,
            collectorId: null,
            matchesAuthenticatedCollector: null,
          },
        };
      }
      const preferenceCollectorId = result.data?.collectorId ?? null;
      return {
        id: 'latest_preference',
        ok: true,
        httpStatus: result.httpStatus,
        errorCode: null,
        message: null,
        data: {
          preferenceId,
          collectorId: preferenceCollectorId,
          matchesAuthenticatedCollector:
            preferenceCollectorId != null && collectorId != null
              ? preferenceCollectorId === collectorId
              : null,
        },
      };
    } catch {
      return {
        id: 'latest_preference',
        ok: false,
        httpStatus: null,
        errorCode: 'unexpected_error',
        message: 'Preference lookup failed unexpectedly',
        data: {
          preferenceId,
          collectorId: null,
          matchesAuthenticatedCollector: null,
        },
      };
    }
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
