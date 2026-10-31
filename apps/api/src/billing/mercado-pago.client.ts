import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PREMIUM_PRODUCT_CODE } from './billing.constants';
import {
  readMercadoPagoConfig,
  type MercadoPagoConfig,
} from './mercado-pago.config';
import { sanitizeMercadoPagoError } from './mercado-pago.diagnostic';
import { decimalToMinorUnits, minorUnitsToDecimal } from './mercado-pago.money';

const DIAGNOSTIC_TIMEOUT_MS = 12_000;

const API_BASE = 'https://api.mercadopago.com';

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string;
  currency: string;
  amountMinor: number | null;
  transactionAmount: number;
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
  config(): MercadoPagoConfig | null {
    return readMercadoPagoConfig(process.env);
  }

  async createPreference(input: {
    orderId: string;
    amountMinor: number;
  }): Promise<{ id: string; initPoint: string }> {
    const config = this.requireConfig();
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

    const payload = await this.request<PreferenceResponse>(
      config,
      '/checkout/preferences',
      { method: 'POST', body },
    );
    const initPoint = config.sandbox
      ? payload.sandbox_init_point
      : payload.init_point;
    if (!payload.id || !initPoint) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    return { id: payload.id, initPoint };
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

  /** Read-only helper for temporary admin diagnostics. Returns Pix-related methods only. */
  async inspectPixPaymentMethods(): Promise<
    MercadoPagoDiagnosticHttpResult<{
      pixPaymentMethods: MercadoPagoPixMethodSummary[];
      paymentMethodCount: number;
    }>
  > {
    const result = await this.diagnosticGet<unknown>('/v1/payment_methods');
    if (!result.ok) {
      return { ...result, data: null };
    }
    if (!Array.isArray(result.data)) {
      return {
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: 'unexpected_response',
        message: 'payment_methods did not return a list',
        data: null,
      };
    }
    return {
      ...result,
      data: {
        paymentMethodCount: result.data.length,
        pixPaymentMethods: this.toPixMethods(result.data),
      },
    };
  }

  /** Read-only helper for temporary admin diagnostics. */
  async inspectPreferenceCollector(
    preferenceId: string,
  ): Promise<
    MercadoPagoDiagnosticHttpResult<{ collectorId: number | null }>
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
    const result = await this.diagnosticGet<{
      collector_id?: number | string;
    }>(`/checkout/preferences/${encodeURIComponent(trimmed)}`);
    if (!result.ok) {
      return { ...result, data: null };
    }
    if (result.data?.collector_id == null) {
      return {
        ...result,
        data: { collectorId: null },
      };
    }
    const id = Number(result.data.collector_id);
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        httpStatus: result.httpStatus,
        errorCode: 'incomplete_response',
        message: 'Preference collector id was invalid',
        data: null,
      };
    }
    return {
      ...result,
      data: { collectorId: Math.trunc(id) },
    };
  }

  private toPixMethods(payload: unknown[]): MercadoPagoPixMethodSummary[] {
    const rows: MercadoPagoPixMethodSummary[] = [];
    for (const entry of payload) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const paymentTypeId =
        typeof row.payment_type_id === 'string'
          ? row.payment_type_id.trim()
          : typeof row.type === 'string'
            ? row.type.trim()
            : '';
      const status = typeof row.status === 'string' ? row.status.trim() : '';
      const isPix =
        id.toLowerCase() === 'pix' ||
        paymentTypeId.toLowerCase() === 'bank_transfer';
      if (!isPix || !id) {
        continue;
      }
      rows.push({
        id,
        payment_type_id: paymentTypeId || 'unknown',
        status: status || 'unknown',
      });
    }
    return rows;
  }

  private async diagnosticGet<T>(
    path: string,
  ): Promise<MercadoPagoDiagnosticHttpResult<T>> {
    const config = this.config();
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
    const timer = setTimeout(() => controller.abort(), DIAGNOSTIC_TIMEOUT_MS);
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
    };
  }
}
