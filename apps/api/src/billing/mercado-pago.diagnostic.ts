export type MercadoPagoDiagnosticStepId =
  | 'config'
  | 'users_me'
  | 'payment_methods'
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

const SECRET_PATTERN =
  /\b(?:bearer\s+)?(?:APP_USR-|TEST-|APP_ID-)[A-Za-z0-9._-]{8,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function sanitizeMercadoPagoDiagnosticText(value: string): string {
  return value
    .replace(SECRET_PATTERN, '[redacted]')
    .replace(JWT_PATTERN, '[redacted]')
    .replace(/authorization:\s*bearer\s+\S+/gi, 'authorization: [redacted]')
    .slice(0, 240);
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
