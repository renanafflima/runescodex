export type MercadoPagoDiagnosticStepId =
  | 'config'
  | 'users_me'
  | 'payment_methods'
  | 'reusable_preferences'
  | 'latest_preference'
  | 'reusable_pending_checkouts';

export type MercadoPagoDiagnosticStep<T = unknown> = {
  id: MercadoPagoDiagnosticStepId;
  ok: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  message: string | null;
  data: T | null;
};

export type MercadoPagoPaymentMethodsOutcome =
  | 'not_configured'
  | 'http_error'
  | 'timeout'
  | 'network_error'
  | 'unexpected_response'
  | 'unexpected_error'
  | 'valid_empty_catalog'
  | 'valid_without_pix'
  | 'valid_with_pix';

export type MercadoPagoPaymentMethodSample = {
  id: string;
  payment_type_id: string;
  status: string;
};

export type MercadoPagoExcludedIdView = {
  id: string;
};

export type MercadoPagoPreferencePaymentMethodsView = {
  excludedPaymentMethods: MercadoPagoExcludedIdView[];
  excludedPaymentTypes: MercadoPagoExcludedIdView[];
  defaultPaymentMethodId: string | null;
  installments: number | null;
};

export type MercadoPagoPreferenceDiagnosticView = {
  collectorId: number | null;
  preferenceCreatedAt: string | null;
  paymentMethods: MercadoPagoPreferencePaymentMethodsView | null;
  excludedPaymentMethods: MercadoPagoExcludedIdView[];
  excludedPaymentTypes: MercadoPagoExcludedIdView[];
};

export const PAYMENT_METHOD_SAMPLE_LIMIT = 50;
export const REUSABLE_PREFERENCE_LIMIT = 4;
export const PREFERENCE_DIAGNOSTIC_TIMEOUT_MS = 8_000;
export const PREFERENCE_DIAGNOSTIC_BUDGET_MS = 28_000;

const SECRET_PATTERN =
  /\b(?:bearer\s+)?(?:APP_USR-|TEST-|APP_ID-)[A-Za-z0-9._-]{8,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/gi;
const PAYER_HINT_PATTERN =
  /\b(?:payer|buyer|customer|cardholder)(?:_[a-z]+)?\s*[:=]\s*\S+/gi;

export type MercadoPagoOpenCheckoutReuseMatch =
  | 'active'
  | 'not_active'
  | 'inconclusive';

export function sanitizeDiagnosticField(
  value: string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return sanitizeMercadoPagoDiagnosticText(trimmed);
}

export function sanitizeMercadoPagoDiagnosticText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(URL_PATTERN, '[redacted-url]')
    .replace(SECRET_PATTERN, '[redacted-secret]')
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(PAYER_HINT_PATTERN, '[redacted-payer]')
    .replace(/authorization:\s*bearer\s+\S+/gi, 'authorization: [redacted]')
    .slice(0, 240);
}

/**
 * Maps the open checkout payment (same query as findOpenCheckout) to a listed
 * preference row. Checkout reuse is driven by checkoutUrl; preferenceId alone
 * is not always sufficient to prove reuse.
 */
export function resolveOpenCheckoutReuseMatch(input: {
  listedPaymentId: string;
  listedPreferenceId: string;
  openCheckoutPaymentId: string | null;
  openCheckoutPreferenceId: string | null;
  openCheckoutHasUrl: boolean;
  ownerListedPaymentIds: string[];
}): MercadoPagoOpenCheckoutReuseMatch {
  if (!input.openCheckoutHasUrl || !input.openCheckoutPaymentId) {
    return 'inconclusive';
  }
  const ownerWinnerListed = input.ownerListedPaymentIds.includes(
    input.openCheckoutPaymentId,
  );
  if (!ownerWinnerListed) {
    return 'inconclusive';
  }
  if (!input.openCheckoutPreferenceId) {
    return 'inconclusive';
  }
  return input.listedPreferenceId === input.openCheckoutPreferenceId
    ? 'active'
    : 'not_active';
}

export function openCheckoutReuseMatchToLegacyFlag(
  match: MercadoPagoOpenCheckoutReuseMatch,
): boolean | null {
  if (match === 'active') {
    return true;
  }
  if (match === 'not_active') {
    return false;
  }
  return null;
}

export function sanitizeMercadoPagoError(input: {
  httpStatus: number | null;
  body: unknown;
  fallback: string;
}): { errorCode: string | null; message: string } {
  const body = input.body;
  if (!body || typeof body !== 'object') {
    return {
      errorCode: null,
      message: sanitizeMercadoPagoDiagnosticText(input.fallback),
    };
  }
  const row = body as Record<string, unknown>;
  const errorCode =
    typeof row.error === 'string' && row.error.trim()
      ? sanitizeMercadoPagoDiagnosticText(row.error.trim())
      : typeof row.code === 'string' && row.code.trim()
        ? sanitizeMercadoPagoDiagnosticText(row.code.trim())
        : null;
  const rawMessage =
    typeof row.message === 'string' && row.message.trim()
      ? row.message.trim()
      : input.fallback;
  return {
    errorCode,
    message: sanitizeMercadoPagoDiagnosticText(rawMessage),
  };
}

export function classifyPaymentMethodsHttpFailure(
  errorCode: string | null,
): MercadoPagoPaymentMethodsOutcome {
  if (errorCode === 'not_configured') {
    return 'not_configured';
  }
  if (errorCode === 'timeout') {
    return 'timeout';
  }
  if (errorCode === 'network_error') {
    return 'network_error';
  }
  return 'http_error';
}

export function classifyPaymentMethodsCatalog(
  paymentMethodCount: number,
  pixCount: number,
): MercadoPagoPaymentMethodsOutcome {
  if (paymentMethodCount <= 0) {
    return 'valid_empty_catalog';
  }
  return pixCount > 0 ? 'valid_with_pix' : 'valid_without_pix';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readSanitizedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return sanitizeMercadoPagoDiagnosticText(trimmed);
}

export function sanitizePaymentMethodSample(
  value: unknown,
): MercadoPagoPaymentMethodSample | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const id = readSanitizedString(row.id);
  if (!id) {
    return null;
  }
  const paymentTypeId =
    readSanitizedString(row.payment_type_id) ??
    readSanitizedString(row.type) ??
    'unknown';
  const status = readSanitizedString(row.status) ?? 'unknown';
  return {
    id,
    payment_type_id: paymentTypeId,
    status,
  };
}

export function sanitizePaymentMethodSampleList(
  value: unknown,
): {
  sample: MercadoPagoPaymentMethodSample[];
  paymentMethodCount: number;
  sampleTruncated: boolean;
} {
  if (!Array.isArray(value)) {
    return { sample: [], paymentMethodCount: 0, sampleTruncated: false };
  }
  const sample: MercadoPagoPaymentMethodSample[] = [];
  for (const entry of value) {
    const row = sanitizePaymentMethodSample(entry);
    if (!row) {
      continue;
    }
    if (sample.length < PAYMENT_METHOD_SAMPLE_LIMIT) {
      sample.push(row);
    }
  }
  return {
    sample,
    paymentMethodCount: value.length,
    sampleTruncated: value.length > PAYMENT_METHOD_SAMPLE_LIMIT,
  };
}

function sanitizeExcludedIdList(value: unknown): MercadoPagoExcludedIdView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: MercadoPagoExcludedIdView[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    const id = row ? readSanitizedString(row.id) : null;
    if (!id) {
      continue;
    }
    rows.push({ id });
  }
  return rows;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function sanitizePreferencePaymentMethods(
  value: unknown,
): MercadoPagoPreferencePaymentMethodsView | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    excludedPaymentMethods: sanitizeExcludedIdList(row.excluded_payment_methods),
    excludedPaymentTypes: sanitizeExcludedIdList(row.excluded_payment_types),
    defaultPaymentMethodId: readSanitizedString(row.default_payment_method_id),
    installments: readFiniteNumber(row.installments),
  };
}

function readCollectorId(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return Math.trunc(id);
}

export function sanitizePreferenceDiagnosticBody(
  body: unknown,
): MercadoPagoPreferenceDiagnosticView {
  const row = asRecord(body);
  const paymentMethods = sanitizePreferencePaymentMethods(
    row?.payment_methods,
  );
  const excludedPaymentMethods =
    paymentMethods?.excludedPaymentMethods ?? [];
  const excludedPaymentTypes = paymentMethods?.excludedPaymentTypes ?? [];
  return {
    collectorId: readCollectorId(row?.collector_id),
    preferenceCreatedAt: readSanitizedString(row?.date_created),
    paymentMethods,
    excludedPaymentMethods,
    excludedPaymentTypes,
  };
}
