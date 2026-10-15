import {
  mercadoPagoManifest,
  signMercadoPagoManifest,
  verifyMercadoPagoSignature,
} from './mercado-pago.signature';

describe('Mercado Pago signature', () => {
  const secret = 'webhook-test-secret';
  const requestId = 'req-1';
  const dataId = '123456';
  const ts = '1700000000';
  const manifest = mercadoPagoManifest(dataId, requestId, ts);
  const v1 = signMercadoPagoManifest(manifest, secret);

  it('accepts a signature built from the documented manifest', () => {
    expect(manifest).toBe('id:123456;request-id:req-1;ts:1700000000;');
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(true);
  });

  it('rejects a missing, forged or mismatched signature', () => {
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${'ab'.repeat(32)}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: undefined,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId: '999',
        secret,
      }),
    ).toBe(false);
  });
});
