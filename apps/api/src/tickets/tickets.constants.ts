export const MAX_TICKET_EVIDENCES = 8;

export const TICKET_EVIDENCE_MAX_BYTES_DEFAULT = 5_000_000;
export const TICKET_EVIDENCE_MAX_BYTES_LIMIT = 10_000_000;

export const TICKET_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type TicketImageMime = (typeof TICKET_IMAGE_MIME_TYPES)[number];

export const TICKET_STORAGE = Symbol('TICKET_STORAGE');
export const TICKET_EVIDENCE_MAX_BYTES = Symbol('TICKET_EVIDENCE_MAX_BYTES');

const EXTENSION_BY_MIME: Record<TicketImageMime, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const STORAGE_KEY =
  /^tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function ticketEvidenceMaxBytes(env: NodeJS.ProcessEnv): number {
  const raw = env.TICKET_EVIDENCE_MAX_BYTES?.trim();
  if (!raw) {
    return TICKET_EVIDENCE_MAX_BYTES_DEFAULT;
  }
  const parsed = Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > TICKET_EVIDENCE_MAX_BYTES_LIMIT
  ) {
    throw new Error(
      'TICKET_EVIDENCE_MAX_BYTES must be an integer from 1 to 10000000',
    );
  }
  return parsed;
}

export function extensionForTicketImage(mimeType: TicketImageMime) {
  return EXTENSION_BY_MIME[mimeType];
}

export function filenameForTicketImage(mimeType: string) {
  if (mimeType === 'image/png') {
    return 'evidence.png';
  }
  if (mimeType === 'image/webp') {
    return 'evidence.webp';
  }
  return 'evidence.jpg';
}

export function isSafeEvidenceStorageKey(storageKey: string) {
  return STORAGE_KEY.test(storageKey);
}

export function buildEvidenceStorageKey(
  ticketId: string,
  mimeType: TicketImageMime,
) {
  const evidenceId = crypto.randomUUID();
  const storageKey = `tickets/${ticketId}/${evidenceId}.${extensionForTicketImage(mimeType)}`;
  if (!isSafeEvidenceStorageKey(storageKey)) {
    throw new Error('Could not build an evidence storage key');
  }
  return storageKey;
}
