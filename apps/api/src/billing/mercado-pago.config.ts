import { resolveAppEnv } from '../common/database-target';
import { isIP } from 'node:net';

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  notificationUrl: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  sandbox: boolean;
};

function isLocalHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === '::1'
  ) {
    return true;
  }

  if (isIP(normalized) === 4) {
    const [first, second] = normalized.split('.').map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (isIP(normalized) === 6) {
    return (
      /^f[cd]/i.test(normalized) ||
      /^fe[89ab]/i.test(normalized) ||
      normalized.startsWith('::ffff:') ||
      normalized === '::'
    );
  }

  return false;
}

function allowedUrl(value: string, appEnv: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const hostname = url.hostname.replace(/\.$/, '');
  const localHostname = isLocalHostname(hostname);
  if (appEnv === 'development' && localHostname) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  return (
    url.protocol === 'https:' &&
    !localHostname &&
    (isIP(hostname.replace(/^\[|\]$/g, '')) !== 0 || hostname.includes('.'))
  );
}

export function readMercadoPagoConfig(
  env: NodeJS.ProcessEnv,
): MercadoPagoConfig | null {
  const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? '';
  const webhookSecret = env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? '';
  const notificationUrl = env.MERCADO_PAGO_NOTIFICATION_URL?.trim() ?? '';
  const successUrl = env.MERCADO_PAGO_BACK_URL_SUCCESS?.trim() ?? '';
  const pendingUrl = env.MERCADO_PAGO_BACK_URL_PENDING?.trim() ?? '';
  const failureUrl = env.MERCADO_PAGO_BACK_URL_FAILURE?.trim() ?? '';
  const appEnv = resolveAppEnv(env);
  const urls = [notificationUrl, successUrl, pendingUrl, failureUrl];
  if (
    !accessToken ||
    !webhookSecret ||
    urls.some((url) => !allowedUrl(url, appEnv))
  ) {
    return null;
  }
  return {
    accessToken,
    webhookSecret,
    notificationUrl,
    successUrl,
    pendingUrl,
    failureUrl,
    sandbox: accessToken.startsWith('TEST-'),
  };
}
