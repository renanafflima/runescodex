import { createHash, createPublicKey, verify, type KeyObject } from 'crypto';

const SPKI_MAX = 512;

export function readP256PublicKey(spkiBase64: string) {
  const trimmed = spkiBase64.trim();
  if (
    !trimmed ||
    trimmed.length > SPKI_MAX ||
    !/^[A-Za-z0-9+/=]+$/.test(trimmed)
  ) {
    return null;
  }
  let key: KeyObject;
  try {
    key = createPublicKey({
      key: Buffer.from(trimmed, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return null;
  }
  if (key.asymmetricKeyType !== 'ec') return null;
  const curve = key.asymmetricKeyDetails?.namedCurve;
  if (curve !== 'prime256v1') return null;
  const hash = createHash('sha256')
    .update(Buffer.from(trimmed, 'base64'))
    .digest('hex');
  return { key, hash, spki: trimmed };
}

export function verifyP256Signature(
  spkiBase64: string,
  nonce: string,
  signatureBase64: string,
) {
  const parsed = readP256PublicKey(spkiBase64);
  if (!parsed || !signatureBase64 || signatureBase64.length > 200) return false;
  try {
    return verify(
      'sha256',
      Buffer.from(nonce, 'utf8'),
      { key: parsed.key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureBase64, 'base64'),
    );
  } catch {
    return false;
  }
}
