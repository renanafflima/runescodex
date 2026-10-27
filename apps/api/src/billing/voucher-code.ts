import { createHash, randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateVoucherCode() {
  const bytes = randomBytes(12);
  let body = '';
  for (const byte of bytes) {
    body += ALPHABET[byte % ALPHABET.length];
  }
  return `RC-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export function normalizeVoucherCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function hashVoucherCode(code: string) {
  return createHash('sha256').update(normalizeVoucherCode(code)).digest('hex');
}

export function voucherPrefix(code: string) {
  return code.slice(0, 7);
}
