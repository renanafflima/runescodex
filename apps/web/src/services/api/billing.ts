import { apiRequest } from "./client";
import type { PremiumAccess } from "./types";

export type CheckoutSession = {
  outcome: "ready" | "in_progress" | "reconciliation_required";
  orderId: string;
  checkoutUrl: string | null;
  amountMinor: number;
  currency: string;
  status: "PENDING" | "IN_PROGRESS" | "RECONCILIATION_REQUIRED";
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
