import {
  TICKET_IMAGE_MIME_TYPES,
  type TicketImageMime,
} from './tickets.constants';

export function detectTicketImageMime(bytes: Buffer): TicketImageMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function declaredTicketImageMime(
  mimeType: string | undefined,
): TicketImageMime | null {
  const declared = mimeType?.split(';')[0]?.trim().toLowerCase();
  if (
    declared === 'image/jpeg' ||
    declared === 'image/png' ||
    declared === 'image/webp'
  ) {
    return declared;
  }
  return null;
}

export function ticketImageMimes() {
  return TICKET_IMAGE_MIME_TYPES;
}
