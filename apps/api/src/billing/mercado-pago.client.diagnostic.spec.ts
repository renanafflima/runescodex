import { MercadoPagoClient } from './mercado-pago.client';

const validEnv = {
  MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-not-a-real-token-value',
  MERCADO_PAGO_WEBHOOK_SECRET: 'webhook-secret',
  MERCADO_PAGO_NOTIFICATION_URL:
    'https://runescodex-api.onrender.com/billing/webhooks/mercadopago',
  MERCADO_PAGO_BACK_URL_SUCCESS: 'https://tritec.app.br/runes/checkout',
  MERCADO_PAGO_BACK_URL_PENDING: 'https://tritec.app.br/runes/checkout',
  MERCADO_PAGO_BACK_URL_FAILURE: 'https://tritec.app.br/runes/checkout',
  APP_ENV: 'production',
};

describe('MercadoPagoClient diagnostics', () => {
  const client = new MercadoPagoClient();
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...validEnv };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('reads the collector from GET /users/me', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 123456789 }),
    });

    const result = await client.inspectAuthenticatedCollector();

    expect(result).toEqual({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: { collectorId: 123456789 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/users/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not treat an empty Pix catalog as a hard failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'visa', payment_type_id: 'credit_card', status: 'active' }],
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      paymentMethodCount: 1,
      pixPaymentMethods: [],
    });
  });

  it('returns Pix-related methods when present', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
        { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
      ],
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.data?.pixPaymentMethods).toEqual([
      { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
    ]);
  });

  it('sanitizes HTTP errors from Mercado Pago', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'unauthorized',
        message: 'invalid access token APP_USR-abcdefghijkl',
      }),
    });

    const result = await client.inspectAuthenticatedCollector();

    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.errorCode).toBe('unauthorized');
    expect(result.message).toBe('invalid access token [redacted]');
    expect(JSON.stringify(result)).not.toContain('APP_USR-abcdefghijkl');
  });

  it('reports a timeout without leaking credentials', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );

    const result = await client.inspectPixPaymentMethods();

    expect(result).toMatchObject({
      ok: false,
      httpStatus: null,
      errorCode: 'timeout',
      message: 'Mercado Pago request timed out',
    });
    expect(JSON.stringify(result)).not.toContain('APP_USR-not-a-real-token-value');
  });

  it('reports an incomplete users/me payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await client.inspectAuthenticatedCollector();

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'incomplete_response',
    });
  });

  it('looks up the preference collector independently', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ collector_id: 123456789 }),
    });

    const result = await client.inspectPreferenceCollector('pref-1');

    expect(result.data).toEqual({ collectorId: 123456789 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mercadopago.com/checkout/preferences/pref-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
