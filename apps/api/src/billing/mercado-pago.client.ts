import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PREMIUM_PRODUCT_CODE } from './billing.constants';
import {
  readMercadoPagoConfig,
  type MercadoPagoConfig,
} from './mercado-pago.config';
import {
  classifyPaymentMethodsCatalog,
  classifyPaymentMethodsHttpFailure,
  PREFERENCE_DIAGNOSTIC_TIMEOUT_MS,
  sanitizeMercadoPagoError,
  sanitizePaymentMethodSample,
  sanitizePaymentMethodSampleList,
  sanitizePreferenceDiagnosticBody,
  type MercadoPagoPaymentMethodSample,
  type MercadoPagoPaymentMethodsOutcome,
  type MercadoPagoPreferenceDiagnosticView,
} from './mercado-pago.diagnostic';
import { decimalToMinorUnits, minorUnitsToDecimal } from './mercado-pago.money';

const DIAGNOSTIC_TIMEOUT_MS = 12_000;
const COLLECTOR_CACHE_TTL_MS = 5 * 60_000;

const API_BASE = 'https://api.mercadopago.com';

export const PREFERENCE_CREATE_TIMEOUT_MS = 20_000;

const DEFINITIVE_PREFERENCE_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string;
  currency: string;
  amountMinor: number | null;
  transactionAmount: number;
  preferenceId: string | null;
};

export type PreferenceCreateOutcome =
  | { ok: true; id: string; initPoint: string }
  | {
      ok: false;
      failure: 'definitive' | 'ambiguous';
      errorCode: string | null;
      message: string | null;
    };

type PreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type PaymentResponse = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  currency_id?: string;
  transaction_amount?: number;
  preference_id?: string;
};

export type MercadoPagoPixMethodSummary = {
  id: string;
  payment_type_id: string;
  status: string;
};

export type MercadoPagoDiagnosticHttpResult<T> = {
  ok: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  message: string | null;
  data: T | null;
};

@Injectable()
export class MercadoPagoClient {
  private collectorCache:
    | {
        accessToken: string;
        collectorId: number;
        expiresAt: number;
      }
    | undefined;

  config(): MercadoPagoConfig | null {
    return readMercadoPagoConfig(process.env);
  }

  async createPreference(input: {
    orderId: string;
    amountMinor: number;
  }): Promise<{ id: string; initPoint: string }> {
    const outcome = await this.createPreferenceOutcome(input);
    if (!outcome.ok) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    return { id: outcome.id, initPoint: outcome.initPoint };
  }

  /**
   * Classifies POST /checkout/preferences without treating every HTTP failure
   * as proof that Mercado Pago did not create a preference.
   */
  async createPreferenceOutcome(input: {
    orderId: string;
    amountMinor: number;
  }): Promise<PreferenceCreateOutcome> {
    const config = this.config();
    if (!config) {
      return {
        ok: false,
        failure: 'definitive',
        errorCode: 'not_configured',
        message: 'Billing provider is not configured',
      };
    }
    const unitPrice = minorUnitsToDecimal(input.amountMinor);
    const body: Record<string, unknown> = {
      items: [
        {
          id: PREMIUM_PRODUCT_CODE,
          title: 'RuneCodex Premium',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: unitPrice,
        },
      ],
      external_reference: input.orderId,
      notification_url: config.notificationUrl,
      back_urls: {
        success: config.successUrl,
        pending: config.pendingUrl,
        failure: config.failureUrl,
      },
      metadata: { order_id: input.orderId },
    };
    if (config.successUrl.startsWith('https://')) {
      body.auto_return = 'approved';
    }

    const result = await this.postPreference(config, body);
    if (!result.ok) {
      return result;
    }
    const initPoint = config.sandbox
      ? result.payload.sandbox_init_point
      : result.payload.init_point;
    if (!result.payload.id || !initPoint) {
      return {
        ok: false,
        failure: 'ambiguous',
        errorCode: 'incomplete_response',
        message: 'Preference response was incomplete',
      };
    }
    return { ok: true, id: result.payload.id, initPoint };
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    if (!/^\d+$/.test(paymentId)) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    const config = this.requireConfig();
    const payload = await this.request<PaymentResponse>(
      config,
      `/v1/payments/${paymentId}`,
      { method: 'GET' },
    );
    return this.toPayment(payload);
  }

  async searchPayments(
    externalReference: string,
  ): Promise<MercadoPagoPayment[]> {
    const config = this.requireConfig();
    const query = new URLSearchParams({
      external_reference: externalReference,
      sort: 'date_created',
      criteria: 'asc',
    });
    const payload = await this.request<{ results?: PaymentResponse[] }>(
      config,
      `/v1/payments/search?${query.toString()}`,
      { method: 'GET' },
    );
    return (payload.results ?? []).map((row) => this.toPayment(row));
  }

  /**
   * Official collector lookup: GET /users/me (not /v1/users/me).
   * Used only by the temporary admin diagnostic.
   */
  async inspectAuthenticatedCollector(): Promise<
    MercadoPagoDiagnosticHttpResult<{ collectorId: number }>
  > {
    const result = await this.diagnosticGet<{ id?: number | string }>(
      '/users/me',
    );
    if (!result.ok) {
      return { ...result, data: null };
    }
    const id = Number(result.data?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: 'incomplete_response',
        message: 'Collector id was missing from users/me',
        data: null,
      };
    }
    return {
      ...result,
      data: { collectorId: Math.trunc(id) },
    };
  }

  /** Read-only helper for temporary admin diagnostics. */
  async inspectPixPaymentMethods(): Promise<
    MercadoPagoDiagnosticHttpResult<{
      outcome: MercadoPagoPaymentMethodsOutcome;
      pixPaymentMethods: MercadoPagoPixMethodSummary[];
      paymentMethodCount: number;
      sample: MercadoPagoPaymentMethodSample[];
      sampleTruncated: boolean;
    }>
  > {
    const empty = {
      pixPaymentMethods: [] as MercadoPagoPixMethodSummary[],
      paymentMethodCount: 0,
      sample: [] as MercadoPagoPaymentMethodSample[],
      sampleTruncated: false,
    };
    const result = await this.diagnosticGet<unknown>('/v1/payment_methods');
    if (!result.ok) {
      return {
        ...result,
        data: {
          ...empty,
          outcome: classifyPaymentMethodsHttpFailure(result.errorCode),
        },
      };
    }
    if (!Array.isArray(result.data)) {
      return {
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: 'unexpected_response',
        message: 'payment_methods did not return a list',
        data: {
          ...empty,
          outcome: 'unexpected_response',
        },
      };
    }
    const listed = sanitizePaymentMethodSampleList(result.data);
    const pixPaymentMethods = this.toPixMethods(result.data);
    return {
      ...result,
      data: {
        outcome: classifyPaymentMethodsCatalog(
          listed.paymentMethodCount,
          pixPaymentMethods.length,
        ),
        paymentMethodCount: listed.paymentMethodCount,
        pixPaymentMethods,
        sample: listed.sample,
        sampleTruncated: listed.sampleTruncated,
      },
    };
  }

  /** Read-only GET /checkout/preferences/{id} with an explicit field whitelist. */
  async inspectPreferenceForDiagnostic(
    preferenceId: string,
    timeoutMs = PREFERENCE_DIAGNOSTIC_TIMEOUT_MS,
  ): Promise<
    MercadoPagoDiagnosticHttpResult<MercadoPagoPreferenceDiagnosticView>
  > {
    const trimmed = preferenceId.trim();
    if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
      return {
        ok: false,
        httpStatus: null,
        errorCode: 'invalid_preference_id',
        message: 'Stored preference id is not safe to request',
        data: null,
      };
    }
    const result = await this.diagnosticGet<unknown>(
      `/checkout/preferences/${encodeURIComponent(trimmed)}`,
      timeoutMs,
    );
    if (!result.ok) {
      return { ...result, data: null };
    }
    return {
      ...result,
      data: sanitizePreferenceDiagnosticBody(result.data),
    };
  }

  /**
   * Read-only preference lookup for administrative reconciliation.
   * 404 is absence. Timeout, network and 5xx are inconclusive.
   */
  async lookupPreference(preferenceId: string): Promise<{
    status: 'found' | 'not_found' | 'inconclusive' | 'invalid_id';
    httpStatus: number | null;
    collectorId: number | null;
    initPoint: string | null;
  }> {
    const trimmed = preferenceId.trim();
    if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
      return {
        status: 'invalid_id',
        httpStatus: null,
        collectorId: null,
        initPoint: null,
      };
    }
    const result = await this.diagnosticGet<PreferenceResponse>(
      `/checkout/preferences/${encodeURIComponent(trimmed)}`,
    );
    if (!result.ok) {
      if (result.httpStatus === 404) {
        return {
          status: 'not_found',
          httpStatus: result.httpStatus,
          collectorId: null,
          initPoint: null,
        };
      }
      return {
        status: 'inconclusive',
        httpStatus: result.httpStatus,
        collectorId: null,
        initPoint: null,
      };
    }
    const config = this.config();
    const initPoint = config?.sandbox
      ? (result.data?.sandbox_init_point ?? null)
      : (result.data?.init_point ?? null);
    const collectorId = Number(
      (result.data as { collector_id?: number } | null)?.collector_id,
    );
    return {
      status: 'found',
      httpStatus: result.httpStatus,
      collectorId: Number.isFinite(collectorId)
        ? Math.trunc(collectorId)
        : null,
      initPoint:
        initPoint && initPoint.startsWith('https://') ? initPoint : null,
    };
  }

  /** Read-only helper for temporary admin diagnostics. */
  async inspectPreferenceCollector(
    preferenceId: string,
  ): Promise<MercadoPagoDiagnosticHttpResult<{ collectorId: number | null }>> {
    const result = await this.inspectPreferenceForDiagnostic(preferenceId);
    if (!result.ok) {
      return { ...result, data: null };
    }
    return {
      ...result,
      data: { collectorId: result.data?.collectorId ?? null },
    };
  }

  /**
   * Fail-closed ownership check for a stored Checkout Pro preference.
   * Both reads use the same current backend access token. Only successful
   * collector lookups are cached, and changing the token invalidates the cache.
   */
  async canReusePreference(preferenceId: string): Promise<boolean> {
    const config = this.config();
    if (!config) {
      return false;
    }
    const trimmed = preferenceId.trim();
    if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
      return false;
    }
    const collectorId = await this.currentCollectorId(config);
    if (collectorId == null) {
      return false;
    }
    const preference = await this.diagnosticGet<unknown>(
      `/checkout/preferences/${encodeURIComponent(trimmed)}`,
      PREFERENCE_DIAGNOSTIC_TIMEOUT_MS,
      config,
    );
    const preferenceCollectorId = preference.ok
      ? sanitizePreferenceDiagnosticBody(preference.data).collectorId
      : null;
    return (
      preference.ok &&
      preferenceCollectorId != null &&
      preferenceCollectorId === collectorId
    );
  }

  private async currentCollectorId(
    config: MercadoPagoConfig,
  ): Promise<number | null> {
    const now = Date.now();
    if (
      this.collectorCache?.accessToken === config.accessToken &&
      this.collectorCache.expiresAt > now
    ) {
      return this.collectorCache.collectorId;
    }
    const collector = await this.diagnosticGet<{ id?: number | string }>(
      '/users/me',
      DIAGNOSTIC_TIMEOUT_MS,
      config,
    );
    const collectorId = Number(collector.data?.id);
    if (!collector.ok || !Number.isFinite(collectorId) || collectorId <= 0) {
      return null;
    }
    const normalizedCollectorId = Math.trunc(collectorId);
    this.collectorCache = {
      accessToken: config.accessToken,
      collectorId: normalizedCollectorId,
      expiresAt: now + COLLECTOR_CACHE_TTL_MS,
    };
    return normalizedCollectorId;
  }

  private isPixMethod(row: MercadoPagoPaymentMethodSample): boolean {
    return (
      row.id.toLowerCase() === 'pix' ||
      row.payment_type_id.toLowerCase() === 'bank_transfer'
    );
  }

  private toPixMethods(payload: unknown[]): MercadoPagoPixMethodSummary[] {
    const rows: MercadoPagoPixMethodSummary[] = [];
    for (const entry of payload) {
      const row = sanitizePaymentMethodSample(entry);
      if (!row || !this.isPixMethod(row)) {
        continue;
      }
      rows.push(row);
    }
    return rows;
  }

  private async diagnosticGet<T>(
    path: string,
    timeoutMs = DIAGNOSTIC_TIMEOUT_MS,
    configured?: MercadoPagoConfig,
  ): Promise<MercadoPagoDiagnosticHttpResult<T>> {
    const config = configured ?? this.config();
    if (!config) {
      return {
        ok: false,
        httpStatus: null,
        errorCode: 'not_configured',
        message: 'Mercado Pago billing is not configured',
        data: null,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        const sanitized = sanitizeMercadoPagoError({
          httpStatus: response.status,
          body,
          fallback: `Mercado Pago returned HTTP ${response.status}`,
        });
        return {
          ok: false,
          httpStatus: response.status,
          errorCode: sanitized.errorCode,
          message: sanitized.message,
          data: null,
        };
      }
      return {
        ok: true,
        httpStatus: response.status,
        errorCode: null,
        message: null,
        data: body as T,
      };
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('abort'));
      return {
        ok: false,
        httpStatus: null,
        errorCode: timedOut ? 'timeout' : 'network_error',
        message: timedOut
          ? 'Mercado Pago request timed out'
          : 'Mercado Pago request failed',
        data: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async postPreference(
    config: MercadoPagoConfig,
    body: Record<string, unknown>,
  ): Promise<
    | { ok: true; payload: PreferenceResponse }
    | Extract<PreferenceCreateOutcome, { ok: false }>
  > {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      PREFERENCE_CREATE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${API_BASE}/checkout/preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let parsed: unknown = null;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      if (!response.ok) {
        const sanitized = sanitizeMercadoPagoError({
          httpStatus: response.status,
          body: parsed,
          fallback: `Mercado Pago returned HTTP ${response.status}`,
        });
        return {
          ok: false,
          failure: DEFINITIVE_PREFERENCE_HTTP_STATUSES.has(response.status)
            ? 'definitive'
            : 'ambiguous',
          errorCode: sanitized.errorCode,
          message: sanitized.message,
        };
      }
      if (!parsed || typeof parsed !== 'object') {
        return {
          ok: false,
          failure: 'ambiguous',
          errorCode: 'incomplete_response',
          message: 'Preference response was incomplete',
        };
      }
      return { ok: true, payload: parsed as PreferenceResponse };
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('abort'));
      return {
        ok: false,
        failure: 'ambiguous',
        errorCode: timedOut ? 'timeout' : 'network_error',
        message: timedOut
          ? 'Mercado Pago request timed out'
          : 'Mercado Pago request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private requireConfig() {
    const config = this.config();
    if (!config) {
      throw new ServiceUnavailableException(
        'Billing provider is not configured',
      );
    }
    return config;
  }

  private async request<T>(
    config: MercadoPagoConfig,
    path: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
  }

  private toPayment(payload: PaymentResponse): MercadoPagoPayment {
    const transactionAmount = Number(payload.transaction_amount);
    return {
      id: payload.id == null ? '' : String(payload.id),
      status: payload.status ?? '',
      externalReference: payload.external_reference ?? '',
      currency: payload.currency_id ?? '',
      amountMinor: Number.isFinite(transactionAmount)
        ? decimalToMinorUnits(transactionAmount)
        : null,
      transactionAmount,
      preferenceId: payload.preference_id?.trim() || null,
    };
  }
}
