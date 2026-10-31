import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MERCADO_PAGO_PROVIDER,
  PREMIUM_PRODUCT_CODE,
} from '../../billing/billing.constants';
import {
  MercadoPagoClient,
  type MercadoPagoDiagnosticHttpResult,
  type MercadoPagoPixMethodSummary,
} from '../../billing/mercado-pago.client';
import {
  openCheckoutReuseMatchToLegacyFlag,
  PREFERENCE_DIAGNOSTIC_BUDGET_MS,
  PREFERENCE_DIAGNOSTIC_TIMEOUT_MS,
  REUSABLE_PREFERENCE_LIMIT,
  resolveOpenCheckoutReuseMatch,
  sanitizeDiagnosticField,
  type MercadoPagoDiagnosticStep,
  type MercadoPagoOpenCheckoutReuseMatch,
  type MercadoPagoPaymentMethodSample,
  type MercadoPagoPaymentMethodsOutcome,
  type MercadoPagoPreferenceDiagnosticView,
} from '../../billing/mercado-pago.diagnostic';
import { PrismaService } from '../../prisma/prisma.service';

export type MercadoPagoLatestPreferenceView = {
  preferenceId: string;
  collectorId: number | null;
  matchesAuthenticatedCollector: boolean | null;
};

export type MercadoPagoReusablePreferenceItemView = {
  itemKey: string;
  reuseOwnerKey: string;
  /** @deprecated Prefer openCheckoutReuseMatch; null means inconclusive, not inactive. */
  isActiveOpenCheckout: boolean | null;
  openCheckoutReuseMatch: MercadoPagoOpenCheckoutReuseMatch;
  preferenceId: string;
  paymentCreatedAt: string;
  paymentStatus: string;
  orderStatus: string;
  mercadoPago: {
    ok: boolean;
    httpStatus: number | null;
    errorCode: string | null;
    message: string | null;
    skipped: boolean;
    collectorId: number | null;
    matchesAuthenticatedCollector: boolean | null;
    preferenceCreatedAt: string | null;
    paymentMethods: MercadoPagoPreferenceDiagnosticView['paymentMethods'];
    excludedPaymentMethods: MercadoPagoPreferenceDiagnosticView['excludedPaymentMethods'];
    excludedPaymentTypes: MercadoPagoPreferenceDiagnosticView['excludedPaymentTypes'];
  };
};

export type MercadoPagoReusablePreferencesView = {
  listedCount: number;
  totalReusableCount: number | null;
  reuseOwnerCount: number;
  partialFailures: number;
  listingNote: string;
  items: MercadoPagoReusablePreferenceItemView[];
};

export type MercadoPagoAdminDiagnosticView = {
  temporary: true;
  diagnosticSchemaVersion: 2;
  configured: boolean;
  productionCheckoutMode: boolean | null;
  collectorId: number | null;
  paymentMethodsOutcome: MercadoPagoPaymentMethodsOutcome | null;
  pixPaymentMethods: MercadoPagoPixMethodSummary[];
  pixCatalogNote: string;
  latestPreference: MercadoPagoLatestPreferenceView | null;
  reusablePendingCheckouts: number | null;
  reusablePreferences: MercadoPagoReusablePreferencesView | null;
  failedSteps: string[];
  steps: MercadoPagoDiagnosticStep[];
};

type ReusablePaymentRow = {
  paymentId: string;
  providerCheckoutId: string;
  createdAt: Date;
  status: string;
  userId: string;
  orderStatus: string;
};

type OpenCheckoutSnapshot = {
  paymentId: string;
  providerCheckoutId: string | null;
  hasCheckoutUrl: boolean;
};

const REUSABLE_PREFERENCES_LISTING_NOTE =
  'Lists up to four newest reusable checkouts globally. The checkout each owner would reuse via findOpenCheckout may not appear here when more than four exist or when reuse is keyed by checkoutUrl without a stored preference id.';

type PreferenceLookup = MercadoPagoDiagnosticHttpResult<MercadoPagoPreferenceDiagnosticView> & {
  skipped?: boolean;
};

function diagnosticEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC?.trim().toLowerCase() ===
    'true';
}

function ownerKeyForIndex(index: number) {
  const letter = String.fromCharCode(97 + index);
  return index < 26 ? `owner-${letter}` : `owner-${index + 1}`;
}

function matchesCollector(
  preferenceCollectorId: number | null,
  collectorId: number | null,
): boolean | null {
  if (preferenceCollectorId == null || collectorId == null) {
    return null;
  }
  return preferenceCollectorId === collectorId;
}

function emptyMercadoPagoLookup(input: {
  ok: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  message: string | null;
  skipped: boolean;
}): MercadoPagoReusablePreferenceItemView['mercadoPago'] {
  return {
    ok: input.ok,
    httpStatus: input.httpStatus,
    errorCode: sanitizeDiagnosticField(input.errorCode),
    message: sanitizeDiagnosticField(input.message),
    skipped: input.skipped,
    collectorId: null,
    matchesAuthenticatedCollector: null,
    preferenceCreatedAt: null,
    paymentMethods: null,
    excludedPaymentMethods: [],
    excludedPaymentTypes: [],
  };
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

    const collectorId = usersMe.data?.collectorId ?? null;
    const preferenceCache = new Map<string, PreferenceLookup>();

    const reusablePreferences = await this.safeReusablePreferences(
      reusable.data?.count ?? null,
      collectorId,
      preferenceCache,
    );

    const preference = latestPreferenceId.ok
      ? await this.safePreference(
          latestPreferenceId.data,
          collectorId,
          preferenceCache,
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
      reusablePreferences,
      preference,
      reusable,
    ];

    return {
      temporary: true,
      diagnosticSchemaVersion: 2,
      configured: Boolean(config),
      productionCheckoutMode: config ? !config.sandbox : null,
      collectorId,
      paymentMethodsOutcome: paymentMethods.data?.outcome ?? null,
      pixPaymentMethods: paymentMethods.data?.pixPaymentMethods ?? [],
      pixCatalogNote:
        'An empty Pix list here does not prove Checkout Pro cannot offer Pix. Confirm the Pix key and Checkout Pro payment types in the Mercado Pago account. Use paymentMethodsOutcome to distinguish HTTP errors from a valid catalog without Pix.',
      latestPreference: preference.data,
      reusablePendingCheckouts: reusable.data?.count ?? null,
      reusablePreferences: reusablePreferences.data,
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
      outcome: MercadoPagoPaymentMethodsOutcome;
      pixPaymentMethods: MercadoPagoPixMethodSummary[];
      paymentMethodCount: number;
      sample: MercadoPagoPaymentMethodSample[];
      sampleTruncated: boolean;
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
        data: result.data ?? {
          outcome: 'unexpected_error',
          pixPaymentMethods: [],
          paymentMethodCount: 0,
          sample: [],
          sampleTruncated: false,
        },
      };
    } catch {
      return {
        id: 'payment_methods',
        ok: false,
        httpStatus: null,
        errorCode: 'unexpected_error',
        message: 'payment_methods failed unexpectedly',
        data: {
          outcome: 'unexpected_error',
          pixPaymentMethods: [],
          paymentMethodCount: 0,
          sample: [],
          sampleTruncated: false,
        },
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

  private async safeReusablePreferences(
    totalReusableCount: number | null,
    collectorId: number | null,
    cache: Map<string, PreferenceLookup>,
  ): Promise<
    MercadoPagoDiagnosticStep<MercadoPagoReusablePreferencesView>
  > {
    try {
      const rows = await this.listReusablePendingCheckouts();
      const openCheckoutByOwner = await this.openCheckoutSnapshotByUser(
        rows.map((row) => row.userId),
      );
      const listedPaymentIdsByOwner = new Map<string, string[]>();
      for (const row of rows) {
        const current = listedPaymentIdsByOwner.get(row.userId) ?? [];
        current.push(row.paymentId);
        listedPaymentIdsByOwner.set(row.userId, current);
      }
      const ownerKeys = new Map<string, string>();
      const items: MercadoPagoReusablePreferenceItemView[] = [];
      let remainingBudget = PREFERENCE_DIAGNOSTIC_BUDGET_MS;
      let partialFailures = 0;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        let reuseOwnerKey = ownerKeys.get(row.userId);
        if (!reuseOwnerKey) {
          reuseOwnerKey = ownerKeyForIndex(ownerKeys.size);
          ownerKeys.set(row.userId, reuseOwnerKey);
        }
        const openCheckout = openCheckoutByOwner.get(row.userId) ?? null;
        const reuseMatch = resolveOpenCheckoutReuseMatch({
          listedPaymentId: row.paymentId,
          listedPreferenceId: row.providerCheckoutId,
          openCheckoutPaymentId: openCheckout?.paymentId ?? null,
          openCheckoutPreferenceId: openCheckout?.providerCheckoutId ?? null,
          openCheckoutHasUrl: openCheckout?.hasCheckoutUrl ?? false,
          ownerListedPaymentIds:
            listedPaymentIdsByOwner.get(row.userId) ?? [],
        });
        const lookup = await this.lookupPreference(
          row.providerCheckoutId,
          cache,
          remainingBudget,
        );
        if (!lookup.fromCache) {
          remainingBudget -= lookup.elapsedMs;
        }
        if (!lookup.result.ok) {
          partialFailures += 1;
        }
        items.push({
          itemKey: `item-${index + 1}`,
          reuseOwnerKey,
          openCheckoutReuseMatch: reuseMatch,
          isActiveOpenCheckout: openCheckoutReuseMatchToLegacyFlag(reuseMatch),
          preferenceId: row.providerCheckoutId,
          paymentCreatedAt: row.createdAt.toISOString(),
          paymentStatus: row.status,
          orderStatus: row.orderStatus,
          mercadoPago: this.toPreferenceMercadoPagoView(
            lookup.result,
            collectorId,
          ),
        });
      }

      return {
        id: 'reusable_preferences',
        ok: true,
        httpStatus: null,
        errorCode: null,
        message: null,
        data: {
          listedCount: items.length,
          totalReusableCount,
          reuseOwnerCount: ownerKeys.size,
          partialFailures,
          listingNote: REUSABLE_PREFERENCES_LISTING_NOTE,
          items,
        },
      };
    } catch {
      return {
        id: 'reusable_preferences',
        ok: false,
        httpStatus: null,
        errorCode: 'database_error',
        message: 'Could not list reusable pending preferences',
        data: {
          listedCount: 0,
          totalReusableCount,
          reuseOwnerCount: 0,
          partialFailures: 0,
          listingNote: REUSABLE_PREFERENCES_LISTING_NOTE,
          items: [],
        },
      };
    }
  }

  private async safePreference(
    preferenceId: string | null,
    collectorId: number | null,
    cache: Map<string, PreferenceLookup>,
  ): Promise<
    MercadoPagoDiagnosticStep<MercadoPagoLatestPreferenceView | null>
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
      const lookup = await this.lookupPreference(
        preferenceId,
        cache,
        PREFERENCE_DIAGNOSTIC_BUDGET_MS,
      );
      const result = lookup.result;
      if (!result.ok) {
      return {
        id: 'latest_preference',
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: sanitizeDiagnosticField(result.errorCode),
        message: sanitizeDiagnosticField(result.message),
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
          matchesAuthenticatedCollector: matchesCollector(
            preferenceCollectorId,
            collectorId,
          ),
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

  private async lookupPreference(
    preferenceId: string,
    cache: Map<string, PreferenceLookup>,
    remainingBudgetMs: number,
  ): Promise<{
    result: PreferenceLookup;
    fromCache: boolean;
    elapsedMs: number;
  }> {
    const cached = cache.get(preferenceId);
    if (cached) {
      return { result: cached, fromCache: true, elapsedMs: 0 };
    }
    if (remainingBudgetMs <= 0) {
      const skipped: PreferenceLookup = {
        ok: false,
        httpStatus: null,
        errorCode: 'budget_exceeded',
        message: 'Preference lookup skipped after the diagnostic time budget',
        data: null,
        skipped: true,
      };
      cache.set(preferenceId, skipped);
      return { result: skipped, fromCache: false, elapsedMs: 0 };
    }
    const started = Date.now();
    const timeoutMs = Math.min(
      PREFERENCE_DIAGNOSTIC_TIMEOUT_MS,
      remainingBudgetMs,
    );
    let result: PreferenceLookup;
    try {
      result = {
        ...(await this.mercadoPago.inspectPreferenceForDiagnostic(
          preferenceId,
          timeoutMs,
        )),
        skipped: false,
      };
    } catch {
      result = {
        ok: false,
        httpStatus: null,
        errorCode: 'unexpected_error',
        message: 'Preference lookup failed unexpectedly',
        data: null,
        skipped: false,
      };
    }
    cache.set(preferenceId, result);
    return {
      result,
      fromCache: false,
      elapsedMs: Date.now() - started,
    };
  }

  private toPreferenceMercadoPagoView(
    result: PreferenceLookup,
    collectorId: number | null,
  ): MercadoPagoReusablePreferenceItemView['mercadoPago'] {
    if (!result.ok || !result.data) {
      return emptyMercadoPagoLookup({
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        message: result.message,
        skipped: Boolean(result.skipped),
      });
    }
    return {
      ok: true,
      httpStatus: result.httpStatus,
      errorCode: null,
      message: null,
      skipped: false,
      collectorId: result.data.collectorId,
      matchesAuthenticatedCollector: matchesCollector(
        result.data.collectorId,
        collectorId,
      ),
      preferenceCreatedAt: result.data.preferenceCreatedAt,
      paymentMethods: result.data.paymentMethods,
      excludedPaymentMethods: result.data.excludedPaymentMethods,
      excludedPaymentTypes: result.data.excludedPaymentTypes,
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
      where: this.reusablePendingCheckoutWhere(),
    });
  }

  private async listReusablePendingCheckouts(): Promise<ReusablePaymentRow[]> {
    const payments = await this.prisma.billingPayment.findMany({
      where: this.reusablePendingCheckoutWhere(),
      orderBy: { createdAt: 'desc' },
      take: REUSABLE_PREFERENCE_LIMIT,
      select: {
        id: true,
        providerCheckoutId: true,
        createdAt: true,
        status: true,
        order: {
          select: {
            userId: true,
            status: true,
          },
        },
      },
    });
    const rows: ReusablePaymentRow[] = [];
    for (const payment of payments) {
      const preferenceId = payment.providerCheckoutId?.trim() ?? '';
      if (!preferenceId) {
        continue;
      }
      rows.push({
        paymentId: payment.id,
        providerCheckoutId: preferenceId,
        createdAt: payment.createdAt,
        status: payment.status,
        userId: payment.order.userId,
        orderStatus: payment.order.status,
      });
    }
    return rows;
  }

  /**
   * Same query as BillingService.findOpenCheckout, used only to compare listed
   * preferences with the payment that checkout would reuse. Does not change checkout.
   */
  private async findOpenCheckoutSnapshot(
    userId: string,
  ): Promise<OpenCheckoutSnapshot | null> {
    const payment = await this.prisma.billingPayment.findFirst({
      where: {
        status: 'PENDING',
        checkoutUrl: { not: null },
        order: {
          userId,
          status: 'PENDING',
          market: 'BR',
          product: { code: PREMIUM_PRODUCT_CODE },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        checkoutUrl: true,
        providerCheckoutId: true,
      },
    });
    if (!payment?.checkoutUrl) {
      return null;
    }
    const providerCheckoutId = payment.providerCheckoutId?.trim() ?? '';
    return {
      paymentId: payment.id,
      hasCheckoutUrl: true,
      providerCheckoutId: providerCheckoutId || null,
    };
  }

  private async openCheckoutSnapshotByUser(
    userIds: string[],
  ): Promise<Map<string, OpenCheckoutSnapshot | null>> {
    const unique = [...new Set(userIds)];
    const entries = await Promise.all(
      unique.map(
        async (userId) =>
          [userId, await this.findOpenCheckoutSnapshot(userId)] as const,
      ),
    );
    return new Map(entries);
  }

  private reusablePendingCheckoutWhere() {
    return {
      status: 'PENDING' as const,
      checkoutUrl: { not: null },
      order: {
        status: 'PENDING' as const,
        market: 'BR' as const,
        product: { code: PREMIUM_PRODUCT_CODE },
      },
    };
  }
}

export { diagnosticEnabled };
