import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createTicketProtocol(bytes = randomBytes(10)) {
  let body = '';
  for (let index = 0; index < 10; index += 1) {
    body += ALPHABET[bytes[index % bytes.length] % ALPHABET.length];
  }
  return `RC-${body}`;
}

export function hourBucket(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

const SESSION_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSessionKey(value: string) {
  return SESSION_KEY.test(value);
}

/** Drops control characters and values that look like an email address. */
export function normalizeSearchTerm(value: string) {
  const term = Array.from(value.normalize('NFKC'))
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
  if (term.length < 2 || term.length > 80 || term.includes('@')) {
    return null;
  }
  return term;
}
