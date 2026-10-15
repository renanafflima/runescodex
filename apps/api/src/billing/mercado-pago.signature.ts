import { createHmac, timingSafeEqual } from 'crypto';

export function mercadoPagoManifest(
  dataId: string,
  requestId: string,
  ts: string,
) {
  const id = /^[A-Za-z0-9]+$/.test(dataId) ? dataId.toLowerCase() : dataId;
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

export function signMercadoPagoManifest(manifest: string, secret: string) {
  return createHmac('sha256', secret).update(manifest).digest('hex');
}

export function verifyMercadoPagoSignature(input: {
  signatureHeader: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string | undefined;
}) {
  const secret = input.secret?.trim() ?? '';
  const requestId = input.requestId?.trim() ?? '';
  const dataId = input.dataId?.trim() ?? '';
  const header = input.signatureHeader?.trim() ?? '';
  if (!secret || !requestId || !dataId || !header) {
    return false;
  }

  let ts = '';
  let v1 = '';
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 'ts') {
      ts = value;
    }
    if (key === 'v1') {
      v1 = value;
    }
  }
  if (!ts || !/^[0-9a-f]+$/i.test(v1)) {
    return false;
  }

  const expected = signMercadoPagoManifest(
    mercadoPagoManifest(dataId, requestId, ts),
    secret,
  );
  const actual = Buffer.from(v1.toLowerCase());
  const known = Buffer.from(expected);
  if (actual.length !== known.length) {
    return false;
  }
  return timingSafeEqual(actual, known);
}
