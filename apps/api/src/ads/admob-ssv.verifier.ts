import { createPublicKey, createVerify } from 'node:crypto';

export const ADMOB_VERIFIER_KEYS_URL =
  'https://www.gstatic.com/admob/reward/verifier-keys.json';

export type AdMobVerifierKeyRow = {
  keyId: number;
  pem?: string;
  base64?: string;
};

export type AdMobSsvParams = {
  adNetwork?: string;
  adUnit: string;
  customData?: string;
  keyId: number;
  rewardAmount?: number;
  rewardItem?: string;
  timestamp?: string;
  transactionId: string;
  userId?: string;
};

type KeyCache = {
  fetchedAt: number;
  keys: Map<number, ReturnType<typeof createPublicKey>>;
};

const KEY_CACHE_TTL_MS = 60 * 60_000;
let keyCache: KeyCache | null = null;

export function resetAdMobVerifierKeyCacheForTests() {
  keyCache = null;
}

function parsePublicKey(row: AdMobVerifierKeyRow) {
  if (row.pem?.trim()) {
    return createPublicKey(row.pem);
  }
  if (row.base64?.trim()) {
    return createPublicKey({
      key: Buffer.from(row.base64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  }
  throw new Error(`AdMob key ${row.keyId} is missing pem/base64`);
}

export async function loadAdMobVerifierKeys(
  fetchImpl: typeof fetch = fetch,
): Promise<Map<number, ReturnType<typeof createPublicKey>>> {
  const now = Date.now();
  if (keyCache && now - keyCache.fetchedAt < KEY_CACHE_TTL_MS) {
    return keyCache.keys;
  }

  const response = await fetchImpl(ADMOB_VERIFIER_KEYS_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch AdMob verifier keys');
  }
  const payload = (await response.json()) as { keys?: AdMobVerifierKeyRow[] };
  const rows = Array.isArray(payload.keys) ? payload.keys : [];
  const keys = new Map<number, ReturnType<typeof createPublicKey>>();
  for (const row of rows) {
    const keyId = Number(row.keyId);
    if (!Number.isFinite(keyId)) {
      continue;
    }
    keys.set(keyId, parsePublicKey(row));
  }
  if (keys.size === 0) {
    throw new Error('AdMob verifier keys response was empty');
  }
  keyCache = { fetchedAt: now, keys };
  return keys;
}

/** Query string only (no leading `?`), as received by the server. */
export function extractSignedContent(queryString: string) {
  const signatureToken = 'signature=';
  const signatureIndex = queryString.lastIndexOf(signatureToken);
  if (signatureIndex <= 0 || queryString.charAt(signatureIndex - 1) !== '&') {
    throw new Error('signature must be the penultimate query parameter');
  }
  const toSign = queryString.slice(0, signatureIndex - 1);
  const tail = queryString.slice(signatureIndex);
  const keyToken = '&key_id=';
  const keyIndex = tail.lastIndexOf(keyToken);
  if (keyIndex <= signatureToken.length) {
    throw new Error('key_id must be the last query parameter');
  }
  const signatureEncoded = tail.slice(signatureToken.length, keyIndex);
  const keyIdRaw = tail.slice(keyIndex + keyToken.length);
  const keyId = Number(keyIdRaw);
  if (!Number.isFinite(keyId)) {
    throw new Error('key_id must be numeric');
  }
  if (keyIdRaw.includes('&')) {
    throw new Error('key_id must be the last query parameter');
  }
  return { toSign, signatureEncoded, keyId };
}

export function verifyAdMobSsvSignature(
  queryString: string,
  publicKeys: Map<number, ReturnType<typeof createPublicKey>>,
) {
  const { toSign, signatureEncoded, keyId } = extractSignedContent(queryString);
  const publicKey = publicKeys.get(keyId);
  if (!publicKey) {
    throw new Error(`Unknown AdMob SSV key_id ${keyId}`);
  }
  const signature = Buffer.from(signatureEncoded, 'base64url');
  const ok = createVerify('SHA256')
    .update(toSign)
    .verify({ key: publicKey, dsaEncoding: 'der' }, signature);
  if (!ok) {
    throw new Error('Invalid AdMob SSV signature');
  }
  return keyId;
}

export function parseAdMobSsvQuery(queryString: string): AdMobSsvParams {
  const params = new URLSearchParams(queryString);
  const transactionId = params.get('transaction_id')?.trim();
  const adUnit = params.get('ad_unit')?.trim();
  if (!transactionId) {
    throw new Error('transaction_id is required');
  }
  if (!adUnit) {
    throw new Error('ad_unit is required');
  }
  const keyId = Number(params.get('key_id'));
  if (!Number.isFinite(keyId)) {
    throw new Error('key_id is required');
  }
  const rewardAmountRaw = params.get('reward_amount');
  const rewardAmount =
    rewardAmountRaw == null || rewardAmountRaw === ''
      ? undefined
      : Number(rewardAmountRaw);
  return {
    adNetwork: params.get('ad_network') ?? undefined,
    adUnit,
    customData: params.get('custom_data') ?? undefined,
    keyId,
    rewardAmount: Number.isFinite(rewardAmount) ? rewardAmount : undefined,
    rewardItem: params.get('reward_item') ?? undefined,
    timestamp: params.get('timestamp') ?? undefined,
    transactionId,
    userId: params.get('user_id') ?? undefined,
  };
}
