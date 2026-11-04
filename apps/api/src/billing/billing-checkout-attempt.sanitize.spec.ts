import { sanitizeCheckoutAttemptError } from './billing-checkout-attempt.sanitize';

describe('checkout attempt error sanitization', () => {
  it('redacts tokens, emails, payer hints and URLs', () => {
    const sanitized = sanitizeCheckoutAttemptError({
      code: 'unauthorized APP_USR-abcdefghijkl',
      message:
        'failed for buyer@example.com payer: secret https://api.mercadopago.com/checkout',
    });
    expect(sanitized.lastErrorCode).not.toMatch(/APP_USR-/);
    expect(sanitized.lastErrorMessage).not.toMatch(
      /buyer@|https:\/\/|payer: secret/,
    );
    expect(sanitized.lastErrorMessage).toContain('[redacted-email]');
    expect(sanitized.lastErrorMessage).toContain('[redacted-url]');
  });
});
