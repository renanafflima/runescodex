import { sanitizeMercadoPagoDiagnosticText, sanitizeMercadoPagoError } from './mercado-pago.diagnostic';

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
      message: 'invalid access token [redacted]',
    });
  });
});
