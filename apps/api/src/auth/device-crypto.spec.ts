import { readP256PublicKey, verifyP256Signature } from './device-crypto';

describe('device proof cryptography', () => {
  it('accepts a P-256 signature and rejects a different payload', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const spki = Buffer.from(
      await crypto.subtle.exportKey('spki', pair.publicKey),
    ).toString('base64');
    const nonce = 'abc123nonce';
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        new TextEncoder().encode(nonce),
      ),
    ).toString('base64');

    expect(readP256PublicKey(spki)?.hash).toHaveLength(64);
    expect(verifyP256Signature(spki, nonce, signature)).toBe(true);
    expect(verifyP256Signature(spki, `${nonce}x`, signature)).toBe(false);
    expect(readP256PublicKey('not-a-key')).toBeNull();
  });
});
