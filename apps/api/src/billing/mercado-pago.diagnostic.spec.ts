import {
  PAYMENT_METHOD_SAMPLE_LIMIT,
  classifyPaymentMethodsCatalog,
  classifyPaymentMethodsHttpFailure,
  openCheckoutReuseMatchToLegacyFlag,
  resolveOpenCheckoutReuseMatch,
  sanitizeMercadoPagoDiagnosticText,
  sanitizeMercadoPagoError,
  sanitizePaymentMethodSampleList,
  sanitizePreferenceDiagnosticBody,
} from './mercado-pago.diagnostic';

describe('Mercado Pago diagnostic sanitization', () => {
  it('redacts access tokens, bearer headers and JWTs', () => {
    expect(
      sanitizeMercadoPagoDiagnosticText(
        'token APP_USR-12345678-abcdef-secret and Bearer TEST-zzzzzzzzzzzz',
      ),
    ).not.toMatch(/APP_USR-|TEST-|Bearer TEST/);
    expect(
      sanitizeMercadoPagoDiagnosticText(
        'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
      ),
    ).toBe('authorization: [redacted]');
  });

  it('extracts Mercado Pago error fields without leaking secrets', () => {
    expect(
      sanitizeMercadoPagoError({
        httpStatus: 401,
        body: {
          error: 'unauthorized',
          message: 'invalid access token APP_USR-abcdefghijkl',
        },
        fallback: 'failed',
      }),
    ).toEqual({
      errorCode: 'unauthorized',
      message: 'invalid access token [redacted-secret]',
    });
  });

  it('redacts email, URL and payer hints from Mercado Pago error messages', () => {
    const sanitized = sanitizeMercadoPagoError({
      httpStatus: 400,
      body: {
        error: 'payer_email=shop@example.com',
        message:
          'see https://api.mercadopago.com/help buyer@example.com APP_USR-abcdefghijkl',
      },
      fallback: 'failed',
    });
    expect(sanitized.errorCode).not.toMatch(/shop@|example\.com/);
    expect(sanitized.message).not.toMatch(
      /shop@|buyer@|https:\/\/|APP_USR-/,
    );
    expect(sanitized.message).toContain('[redacted-email]');
    expect(sanitized.message).toContain('[redacted-url]');
    expect(sanitized.message).toContain('[redacted-secret]');
  });

  it('resolves open checkout reuse match without false inactive states', () => {
    expect(
      resolveOpenCheckoutReuseMatch({
        listedPaymentId: 'pay-1',
        listedPreferenceId: 'pref-1',
        openCheckoutPaymentId: 'pay-1',
        openCheckoutPreferenceId: 'pref-1',
        openCheckoutHasUrl: true,
        ownerListedPaymentIds: ['pay-1', 'pay-2'],
      }),
    ).toBe('active');
    expect(
      resolveOpenCheckoutReuseMatch({
        listedPaymentId: 'pay-2',
        listedPreferenceId: 'pref-old',
        openCheckoutPaymentId: 'pay-1',
        openCheckoutPreferenceId: 'pref-1',
        openCheckoutHasUrl: true,
        ownerListedPaymentIds: ['pay-1', 'pay-2'],
      }),
    ).toBe('not_active');
    expect(
      resolveOpenCheckoutReuseMatch({
        listedPaymentId: 'pay-2',
        listedPreferenceId: 'pref-old',
        openCheckoutPaymentId: 'pay-new-not-listed',
        openCheckoutPreferenceId: 'pref-new',
        openCheckoutHasUrl: true,
        ownerListedPaymentIds: ['pay-2'],
      }),
    ).toBe('inconclusive');
    expect(
      resolveOpenCheckoutReuseMatch({
        listedPaymentId: 'pay-2',
        listedPreferenceId: 'pref-old',
        openCheckoutPaymentId: 'pay-2',
        openCheckoutPreferenceId: null,
        openCheckoutHasUrl: true,
        ownerListedPaymentIds: ['pay-2'],
      }),
    ).toBe('inconclusive');
    expect(
      openCheckoutReuseMatchToLegacyFlag('inconclusive'),
    ).toBeNull();
  });

  it('keeps only whitelisted payment method fields in the sample', () => {
    const listed = sanitizePaymentMethodSampleList([
      {
        id: 'visa',
        payment_type_id: 'credit_card',
        status: 'active',
        email: 'payer@example.com',
        token: 'APP_USR-abcdefghijkl',
      },
      { payment_type_id: 'pix' },
    ]);
    expect(listed).toEqual({
      paymentMethodCount: 2,
      sampleTruncated: false,
      sample: [
        { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
      ],
    });
    expect(JSON.stringify(listed)).not.toMatch(/payer@|APP_USR-/);
  });

  it('truncates the payment method sample at the documented limit', () => {
    const listed = sanitizePaymentMethodSampleList(
      Array.from({ length: PAYMENT_METHOD_SAMPLE_LIMIT + 3 }, (_, index) => ({
        id: `method-${index}`,
        payment_type_id: 'credit_card',
        status: 'active',
      })),
    );
    expect(listed.paymentMethodCount).toBe(PAYMENT_METHOD_SAMPLE_LIMIT + 3);
    expect(listed.sample).toHaveLength(PAYMENT_METHOD_SAMPLE_LIMIT);
    expect(listed.sampleTruncated).toBe(true);
  });

  it('classifies payment method lookup outcomes', () => {
    expect(classifyPaymentMethodsHttpFailure('timeout')).toBe('timeout');
    expect(classifyPaymentMethodsHttpFailure('network_error')).toBe(
      'network_error',
    );
    expect(classifyPaymentMethodsHttpFailure('not_configured')).toBe(
      'not_configured',
    );
    expect(classifyPaymentMethodsHttpFailure('unauthorized')).toBe(
      'http_error',
    );
    expect(classifyPaymentMethodsCatalog(0, 0)).toBe('valid_empty_catalog');
    expect(classifyPaymentMethodsCatalog(4, 0)).toBe('valid_without_pix');
    expect(classifyPaymentMethodsCatalog(4, 1)).toBe('valid_with_pix');
  });

  it('whitelists preference fields and drops payer, email, tokens and checkout URLs', () => {
    const sanitized = sanitizePreferenceDiagnosticBody({
      id: 'pref-1',
      collector_id: 123456789,
      date_created: '2026-10-30T12:00:00.000Z',
      external_reference: 'order-secret-uuid',
      init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
      sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/pref-1',
      payer: {
        email: 'buyer@example.com',
        name: 'Buyer',
      },
      notification_url: 'https://example.invalid/webhook',
      payment_methods: {
        excluded_payment_methods: [{ id: 'visa' }, { secret: 'nope' }],
        excluded_payment_types: [{ id: 'ticket' }],
        default_payment_method_id: 'pix',
        installments: 1,
        extra_secret: 'APP_USR-abcdefghijkl',
      },
      extra: { token: 'APP_USR-abcdefghijkl' },
    });

    expect(sanitized).toEqual({
      collectorId: 123456789,
      preferenceCreatedAt: '2026-10-30T12:00:00.000Z',
      paymentMethods: {
        excludedPaymentMethods: [{ id: 'visa' }],
        excludedPaymentTypes: [{ id: 'ticket' }],
        defaultPaymentMethodId: 'pix',
        installments: 1,
      },
      excludedPaymentMethods: [{ id: 'visa' }],
      excludedPaymentTypes: [{ id: 'ticket' }],
    });
    expect(JSON.stringify(sanitized)).not.toMatch(
      /payer|buyer@|init_point|sandbox_init_point|order-secret|APP_USR-|notification_url/,
    );
  });
});
