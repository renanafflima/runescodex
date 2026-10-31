import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PREMIUM_PRODUCT_CODE } from './billing.constants';
import {
  readMercadoPagoConfig,
  type MercadoPagoConfig,
} from './mercado-pago.config';
import { decimalToMinorUnits, minorUnitsToDecimal } from './mercado-pago.money';

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

  /** Read-only helper for temporary admin diagnostics. Does not log responses. */
  async getAuthenticatedCollectorId(): Promise<number> {
    const config = this.requireConfig();
    const payload = await this.request<{ id?: number | string }>(
      config,
      '/v1/users/me',
      { method: 'GET' },
    );
    const id = Number(payload.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    return Math.trunc(id);
  }

  /** Read-only helper for temporary admin diagnostics. Returns Pix-related methods only. */
  async listPixPaymentMethods(): Promise<MercadoPagoPixMethodSummary[]> {
    const config = this.requireConfig();
    const payload = await this.request<unknown>(
      config,
      '/v1/payment_methods',
      { method: 'GET' },
    );
    if (!Array.isArray(payload)) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
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

  /** Read-only helper for temporary admin diagnostics. */
  async getPreferenceCollectorId(preferenceId: string): Promise<number | null> {
    const trimmed = preferenceId.trim();
    if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    const config = this.requireConfig();
    const payload = await this.request<{ collector_id?: number | string }>(
      config,
      `/checkout/preferences/${encodeURIComponent(trimmed)}`,
      { method: 'GET' },
    );
    if (payload.collector_id == null) {
      return null;
    }
    const id = Number(payload.collector_id);
    if (!Number.isFinite(id) || id <= 0) {
      return null;
    }
    return Math.trunc(id);
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
