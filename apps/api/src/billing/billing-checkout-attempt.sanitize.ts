import { sanitizeDiagnosticField } from './mercado-pago.diagnostic';

export const CHECKOUT_ATTEMPT_ERROR_CODE_LIMIT = 64;
export const CHECKOUT_ATTEMPT_ERROR_MESSAGE_LIMIT = 240;

export function sanitizeCheckoutAttemptError(input: {
  code?: string | null;
  message?: string | null;
}): { lastErrorCode: string | null; lastErrorMessage: string | null } {
  const code = sanitizeDiagnosticField(input.code);
  const message = sanitizeDiagnosticField(input.message);
  return {
    lastErrorCode: code
      ? code.slice(0, CHECKOUT_ATTEMPT_ERROR_CODE_LIMIT)
      : null,
    lastErrorMessage: message
      ? message.slice(0, CHECKOUT_ATTEMPT_ERROR_MESSAGE_LIMIT)
      : null,
  };
}

export function checkoutAttemptIdempotencyKey(
  orderId: string,
  generation: number,
): string {
  return `rc-checkout:${orderId}:${generation}`;
}
