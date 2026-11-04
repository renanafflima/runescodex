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
  let client: MercadoPagoClient;
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    client = new MercadoPagoClient();
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
      json: async () => [
        { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
      ],
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      outcome: 'valid_without_pix',
      paymentMethodCount: 1,
      pixPaymentMethods: [],
      sample: [
        { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
      ],
      sampleTruncated: false,
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

    expect(result.data?.outcome).toBe('valid_with_pix');
    expect(result.data?.pixPaymentMethods).toEqual([
      { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
    ]);
  });

  it('classifies an empty payment method list as a valid empty catalog', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.ok).toBe(true);
    expect(result.data?.outcome).toBe('valid_empty_catalog');
  });

  it('classifies a non-list payment_methods body as unexpected_response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: 'not-a-list' }),
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.ok).toBe(false);
    expect(result.data?.outcome).toBe('unexpected_response');
    expect(result.errorCode).toBe('unexpected_response');
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
    expect(result.message).toBe('invalid access token [redacted-secret]');
    expect(JSON.stringify(result)).not.toContain('APP_USR-abcdefghijkl');
  });

  it('marks payment_methods HTTP failures without treating them as an empty Pix catalog', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden', message: 'denied' }),
    });

    const result = await client.inspectPixPaymentMethods();

    expect(result.ok).toBe(false);
    expect(result.data?.outcome).toBe('http_error');
    expect(result.httpStatus).toBe(403);
  });

  it('classifies network errors from Mercado Pago', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('socket hang up'));

    const result = await client.inspectPixPaymentMethods();

    expect(result).toMatchObject({
      ok: false,
      errorCode: 'network_error',
      data: { outcome: 'network_error' },
    });
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
      data: { outcome: 'timeout' },
    });
    expect(JSON.stringify(result)).not.toContain(
      'APP_USR-not-a-real-token-value',
    );
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

  it('returns a whitelisted preference diagnostic without payer, email, tokens or URLs', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        collector_id: 99,
        date_created: '2026-10-01T00:00:00.000Z',
        init_point:
          'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
        payer: { email: 'buyer@example.com' },
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          extra: 'APP_USR-abcdefghijkl',
        },
      }),
    });

    const result = await client.inspectPreferenceForDiagnostic('pref-1');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      collectorId: 99,
      preferenceCreatedAt: '2026-10-01T00:00:00.000Z',
      paymentMethods: {
        excludedPaymentMethods: [],
        excludedPaymentTypes: [{ id: 'ticket' }],
        defaultPaymentMethodId: null,
        installments: null,
      },
      excludedPaymentMethods: [],
      excludedPaymentTypes: [{ id: 'ticket' }],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /buyer@|init_point|APP_USR-abcdefghijkl/,
    );
  });

  it('reuses a preference owned by the authenticated current collector and caches users/me', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 3543058237 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ collector_id: 3543058237 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ collector_id: 3543058237 }),
      });

    await expect(client.canReusePreference('pref-1')).resolves.toBe(true);
    await expect(client.canReusePreference('pref-2')).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.mercadopago.com/users/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a preference owned by another collector', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 3543058237 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ collector_id: 3546947169 }),
      });

    await expect(client.canReusePreference('pref-old')).resolves.toBe(false);
  });

  it('fails closed when preference lookup returns 401', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 3543058237 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'invalid_caller_id',
          message: 'caller.id invalid',
        }),
      });

    await expect(client.canReusePreference('pref-old')).resolves.toBe(false);
  });

  it('fails closed when preference lookup has a network error', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 3543058237 }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    await expect(client.canReusePreference('pref-old')).resolves.toBe(false);
  });

  it('creates a new preference with the current token context and does not disable Pix', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'pref-new',
        init_point: 'https://www.mercadopago.com.br/checkout/pref-new',
      }),
    });

    await client.createPreference({
      orderId: 'order-1',
      amountMinor: 4990,
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = request.headers as Record<string, string>;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(headers.Authorization).toBe(
      `Bearer ${validEnv.MERCADO_PAGO_ACCESS_TOKEN}`,
    );
    expect(headers['X-Idempotency-Key']).toBeUndefined();
    expect(body).not.toHaveProperty('payment_methods');
    expect(JSON.stringify(body)).not.toMatch(
      /excluded_payment_methods|excluded_payment_types/,
    );
  });

  it('classifies HTTP 400 as a definitive preference failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'bad_request',
        message: 'invalid payload APP_USR-abcdefghijkl',
      }),
    });

    const outcome = await client.createPreferenceOutcome({
      orderId: 'order-1',
      amountMinor: 4990,
    });

    expect(outcome).toEqual({
      ok: false,
      failure: 'definitive',
      errorCode: 'bad_request',
      message: 'invalid payload [redacted-secret]',
    });
  });

  it('classifies timeout, network and HTTP 500 as ambiguous preference outcomes', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    await expect(
      client.createPreferenceOutcome({ orderId: 'order-1', amountMinor: 4990 }),
    ).resolves.toMatchObject({
      ok: false,
      failure: 'ambiguous',
      errorCode: 'timeout',
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(
      client.createPreferenceOutcome({ orderId: 'order-1', amountMinor: 4990 }),
    ).resolves.toMatchObject({
      ok: false,
      failure: 'ambiguous',
      errorCode: 'network_error',
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'unavailable' }),
    });
    await expect(
      client.createPreferenceOutcome({ orderId: 'order-1', amountMinor: 4990 }),
    ).resolves.toMatchObject({
      ok: false,
      failure: 'ambiguous',
    });
  });

  it('treats a 201 without preference id as ambiguous', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ init_point: 'https://www.mercadopago.com.br/x' }),
    });

    await expect(
      client.createPreferenceOutcome({ orderId: 'order-1', amountMinor: 4990 }),
    ).resolves.toEqual({
      ok: false,
      failure: 'ambiguous',
      errorCode: 'incomplete_response',
      message: 'Preference response was incomplete',
    });
  });
});
