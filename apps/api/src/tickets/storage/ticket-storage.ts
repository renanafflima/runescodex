import { resolveAppEnv } from '../../common/database-target';
import { publicHttpsUrl } from '../../common/https-url';
import type { TicketImageMime } from '../tickets.constants';
import { LocalTicketStorage } from './local-ticket-storage';
import { S3TicketStorage } from './s3-ticket-storage';

export class TicketStorageError extends Error {}

export class TicketStorageNotConfiguredError extends TicketStorageError {
  constructor() {
    super('Evidence storage is not configured');
  }
}

export type StoredTicketObject = {
  storageKey: string;
  url: string | null;
};

export type TicketStorageObject = {
  storageKey: string;
  body: Buffer;
  mimeType: TicketImageMime;
};

export interface TicketStorage {
  put(object: TicketStorageObject): Promise<StoredTicketObject>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export function createTicketStorage(env: NodeJS.ProcessEnv): TicketStorage {
  const appEnv = resolveAppEnv(env);
  const requested = env.TICKET_STORAGE_DRIVER?.trim().toLowerCase();
  const driver = requested || (appEnv === 'development' ? 'local' : 's3');
  const publicBaseUrl = readPublicBaseUrl(env.TICKET_STORAGE_PUBLIC_BASE_URL);

  if (driver === 'local') {
    if (appEnv !== 'development') {
      throw new Error(
        'TICKET_STORAGE_DRIVER=local is only allowed when APP_ENV=development',
      );
    }
    return new LocalTicketStorage(
      env.TICKET_STORAGE_LOCAL_DIR?.trim() || '',
      publicBaseUrl,
    );
  }

  if (driver === 's3') {
    return new S3TicketStorage(readS3Config(env, appEnv), publicBaseUrl);
  }

  throw new Error('TICKET_STORAGE_DRIVER must be local or s3');
}

function readPublicBaseUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const url = publicHttpsUrl(raw);
  if (!url) {
    throw new Error('TICKET_STORAGE_PUBLIC_BASE_URL must be an https URL');
  }
  return url.replace(/\/$/, '');
}

function readS3Config(env: NodeJS.ProcessEnv, appEnv: string) {
  const bucket = env.TICKET_STORAGE_S3_BUCKET?.trim() ?? '';
  const region = env.TICKET_STORAGE_S3_REGION?.trim() ?? '';
  const accessKeyId = env.TICKET_STORAGE_S3_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = env.TICKET_STORAGE_S3_SECRET_ACCESS_KEY?.trim() ?? '';
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: readS3Endpoint(env.TICKET_STORAGE_S3_ENDPOINT, appEnv),
    forcePathStyle: env.TICKET_STORAGE_S3_FORCE_PATH_STYLE?.trim() === 'true',
  };
}

function readS3Endpoint(value: string | undefined, appEnv: string) {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('TICKET_STORAGE_S3_ENDPOINT must be an absolute URL');
  }
  if (parsed.username || parsed.password) {
    throw new Error('TICKET_STORAGE_S3_ENDPOINT must not include credentials');
  }

  const local =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol === 'https:') {
    return raw;
  }
  if (parsed.protocol === 'http:' && local && appEnv === 'development') {
    return raw;
  }
  throw new Error('TICKET_STORAGE_S3_ENDPOINT must use https');
}
