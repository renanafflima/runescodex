function redact(message: string): string {
  return message
    .replace(
      /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/\S+/gi,
      '[redacted]',
    )
    .replace(/password=\S+/gi, 'password=[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      '[redacted]',
    )
    .replace(
      /\b(?:authorization|cookie|token|secret|api[_-]?key)\b\s*[:=]\s*\S+/gi,
      '[redacted]',
    );
}

function errorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (typeof error.code === 'string' || typeof error.code === 'number')
  ) {
    return String(error.code);
  }
  return '';
}

function finalMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  const line =
    redact(message)
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1) ?? 'Unexpected error';
  return line.slice(0, 300);
}

export function publicErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return redact(message).slice(0, 300);
}

export function loggedErrorSummary(error: unknown): string {
  const name = error instanceof Error ? error.name : 'UnknownError';
  return [name, errorCode(error), finalMessage(error)]
    .filter(Boolean)
    .join(' ')
    .slice(0, 500);
}

export function loggedErrorStack(error: unknown): string {
  const stack = error instanceof Error ? error.stack : undefined;
  if (!stack) {
    return '';
  }
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith('at ') &&
        /[/\\](?:src|dist)[/\\]/.test(line) &&
        !line.includes('node_modules'),
    )
    .map((line) => redact(line))
    .slice(0, 8)
    .join('\n');
}
