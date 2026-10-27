import { apiRequest } from "./client";

export type MoneyTotal = {
  currency: string;
  count: number;
  amountMinor: number;
};

export type LicenseOverview = {
  activeLicenses: number;
  lifetimeLicenses: number;
  fixedLicenses: number;
  grantedLicenses: number;
  purchasedLicenses: number;
  voucherLicenses: number;
  partnershipLicenses: number;
  activeVouchers: number;
  redemptions: number;
  approvedPayments: MoneyTotal[];
  pendingPayments: MoneyTotal[];
  rejectedPayments: MoneyTotal[];
  refundedPayments: MoneyTotal[];
  commercialDiscount: { available: false; reason: string };
};

export type AdminLicense = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  product: string;
  source: string;
  term: string;
  status: string;
  storedStatus: string;
  activatedAt: string;
  expiresAt: string | null;
};

export type AdminLicensePage = {
  items: AdminLicense[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type AdminPayment = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  product: string;
  providerPaymentId: string | null;
  providerStatus: string | null;
  status: string;
  currency: string;
  amountMinor: number;
  licenseId: string | null;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  syncedAt: string | null;
};

export type AdminVoucher = {
  id: string;
  codePrefix: string;
  benefit: string;
  product: string;
  term: string;
  durationDays: number | null;
  maxRedemptions: number;
  redeemedCount: number;
  remaining: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string | null;
  status: string;
  storedStatus: string;
  campaign: string | null;
  createdAt: string;
};

export type CreatedVoucher = AdminVoucher & { code: string };

export type LicenseUser = {
  id: string;
  email: string;
  name: string | null;
};

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function getLicenseOverview() {
  return apiRequest<LicenseOverview>("/admin/licenses/overview");
}

export function listAdminLicenses(params: { page?: number; search?: string; status?: string }) {
  return apiRequest<AdminLicensePage>(`/admin/licenses${query(params)}`);
}

export function getAdminLicense(id: string) {
  return apiRequest<AdminLicense & {
    reason: string | null;
    payments: Array<{ id: string; status: string; providerPaymentId: string | null; amountMinor: number; currency: string }>;
    grant: { category: string; reason: string; actorName: string } | null;
    redemption: { voucherId: string; at: string } | null;
    events: Array<{ id: string; action: string; summary: string; createdAt: string }>;
  }>(`/admin/licenses/${id}`);
}

export function grantAdminLicense(body: {
  userId: string;
  term: "LIFETIME" | "FIXED";
  durationDays?: number;
  category: string;
  reason: string;
}) {
  return apiRequest<AdminLicense>("/admin/licenses/grants", { method: "POST", json: body });
}

export function changeAdminLicense(id: string, action: "suspend" | "revoke" | "restore" | "extend", body: { reason: string; durationDays?: number }) {
  return apiRequest<AdminLicense>(`/admin/licenses/${id}/${action}`, { method: "POST", json: body });
}

export type AdminPaymentEvent = {
  id: string;
  type: string;
  provider: string;
  createdAt: string;
};

export function listAdminPayments(params: { page?: number; status?: string }) {
  return apiRequest<{ items: AdminPayment[]; page: number; limit: number; total: number }>(
    `/admin/licenses/payments${query(params)}`,
  );
}

export function getAdminPayment(id: string) {
  return apiRequest<AdminPayment & { events: AdminPaymentEvent[] }>(`/admin/licenses/payments/${id}`);
}

export function syncAdminPayment(id: string) {
  return apiRequest<AdminPayment>(`/admin/licenses/payments/${id}/sync`, { method: "POST", json: {} });
}

export function listAdminVouchers(params: { page?: number; search?: string; status?: string } = {}) {
  return apiRequest<{ items: AdminVoucher[]; page: number; limit: number; total: number }>(
    `/admin/licenses/vouchers${query(params)}`,
  );
}

export function getAdminVoucher(id: string) {
  return apiRequest<AdminVoucher & {
    notes: string | null;
    redemptions: Array<{
      id: string;
      userId: string;
      userName: string;
      email: string;
      result: string;
      reason: string | null;
      licenseId: string | null;
      at: string;
    }>;
  }>(`/admin/licenses/vouchers/${id}`);
}

export function createAdminVoucher(body: {
  benefit: string;
  term: "LIFETIME" | "FIXED";
  durationDays?: number;
  maxRedemptions: number;
  perUserLimit: number;
  startsAt?: string;
  endsAt?: string;
  campaign?: string;
  notes?: string;
}) {
  return apiRequest<CreatedVoucher>("/admin/licenses/vouchers", { method: "POST", json: body });
}

export function changeAdminVoucher(id: string, action: "pause" | "resume" | "close") {
  return apiRequest<AdminVoucher>(`/admin/licenses/vouchers/${id}/${action}`, { method: "POST", json: {} });
}

export type PendingGrant = {
  id: string;
  email: string;
  category: string;
  reason: string;
  term: string;
  durationDays: number | null;
  status: string;
  offerExpiresAt: string | null;
  claimedUserId: string | null;
  claimedLicenseId: string | null;
  claimedAt: string | null;
  createdAt: string;
};

export function listPendingGrants(params: { page?: number; status?: string } = {}) {
  return apiRequest<{ items: PendingGrant[]; page: number; limit: number; total: number }>(
    `/admin/licenses/pending-grants${query(params)}`,
  );
}

export function schedulePendingGrant(body: {
  email: string;
  term: "LIFETIME" | "FIXED";
  durationDays?: number;
  category: string;
  reason: string;
  offerExpiresAt?: string;
}) {
  return apiRequest<PendingGrant>("/admin/licenses/pending-grants", { method: "POST", json: body });
}

export function cancelPendingGrant(id: string, reason: string) {
  return apiRequest<PendingGrant>(`/admin/licenses/pending-grants/${id}/cancel`, {
    method: "POST",
    json: { reason },
  });
}

export function searchLicenseUsers(search: string) {
  return apiRequest<LicenseUser[]>(`/admin/licenses/users?search=${encodeURIComponent(search)}`);
}

export function getLicenseActivity() {
  return apiRequest<Array<{ id: string; action: string; summary: string; createdAt: string; entityType: string }>>(
    "/admin/licenses/activity",
  );
}
