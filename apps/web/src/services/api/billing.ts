import { apiRequest } from "./client";
import type { PremiumAccess } from "./types";

export type CheckoutSession = {
  orderId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  status: "PENDING";
};

export function startCheckout() {
  return apiRequest<CheckoutSession>("/billing/checkout", {
    method: "POST",
    json: {},
  });
}

export function refreshCheckout() {
  return apiRequest<PremiumAccess>("/billing/checkout/refresh", {
    method: "POST",
    json: {},
  });
}

export function redeemVoucher(code: string) {
  return apiRequest<PremiumAccess>("/billing/vouchers/redeem", {
    method: "POST",
    json: { code },
  });
}
