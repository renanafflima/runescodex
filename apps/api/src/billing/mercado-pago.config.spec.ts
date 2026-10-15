import { readMercadoPagoConfig } from './mercado-pago.config';

const validConfig = {
  MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token',
  MERCADO_PAGO_WEBHOOK_SECRET: 'webhook-secret',
  MERCADO_PAGO_NOTIFICATION_URL:
    'https://api.example.com/billing/webhooks/mercadopago',
  MERCADO_PAGO_BACK_URL_SUCCESS: 'https://app.example.com/checkout',
  MERCADO_PAGO_BACK_URL_PENDING: 'https://app.example.com/checkout',
  MERCADO_PAGO_BACK_URL_FAILURE: 'https://app.example.com/checkout',
};

describe('readMercadoPagoConfig', () => {
  it('accepts configured public HTTPS URLs outside development', () => {
    expect(
      readMercadoPagoConfig({ ...validConfig, APP_ENV: 'production' }),
    ).toMatchObject({
      notificationUrl: validConfig.MERCADO_PAGO_NOTIFICATION_URL,
      sandbox: true,
    });
  });

  it.each([
    'not-a-url',
    'https://',
    'https://localhost/webhooks',
    'https://127.0.0.1/webhooks',
    'https://192.168.1.10/webhooks',
    'http://api.example.com/webhooks',
  ])('rejects an invalid or non-public production URL: %s', (url) => {
    expect(
      readMercadoPagoConfig({
        ...validConfig,
        APP_ENV: 'production',
        MERCADO_PAGO_NOTIFICATION_URL: url,
      }),
    ).toBeNull();
  });

  it('allows loopback HTTP URLs in development', () => {
    expect(
      readMercadoPagoConfig({
        ...validConfig,
        APP_ENV: 'development',
        MERCADO_PAGO_NOTIFICATION_URL:
          'http://localhost:3000/billing/webhooks/mercadopago',
        MERCADO_PAGO_BACK_URL_SUCCESS: 'http://localhost:5173/checkout',
        MERCADO_PAGO_BACK_URL_PENDING: 'http://localhost:5173/checkout',
        MERCADO_PAGO_BACK_URL_FAILURE: 'http://localhost:5173/checkout',
      }),
    ).not.toBeNull();
  });
});
