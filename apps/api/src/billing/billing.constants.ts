/** Paid Premium. This is not the Diamond flag on RewardCatalogItem. */
export const PREMIUM_PRODUCT_CODE = 'RUNECODEX_PREMIUM';

export const APPROVED_BILLING_PRICES = {
  BR: { currency: 'BRL', amountMinor: 4990 },
  INTL: { currency: 'USD', amountMinor: 1499 },
} as const;

export const BILLING_MARKETS = ['BR', 'INTL'] as const;
export type BillingMarketCode = (typeof BILLING_MARKETS)[number];

export const MERCADO_PAGO_PROVIDER = 'mercadopago';
export const REVENUECAT_PROVIDER = 'revenuecat';
export const REVENUECAT_PREMIUM_ENTITLEMENT = 'premium';

export const BILLING_EVENT_TYPES = [
  'PAYMENT_PENDING',
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  'PAYMENT_REFUNDED',
] as const;
export type BillingEventTypeCode = (typeof BILLING_EVENT_TYPES)[number];

export function isBillingMarket(value: string): value is BillingMarketCode {
  return (BILLING_MARKETS as readonly string[]).includes(value);
}

export function activeUserProductKey(userId: string, productId: string) {
  return `${userId}:${productId}`;
}
