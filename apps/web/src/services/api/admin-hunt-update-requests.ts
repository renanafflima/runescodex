import { apiRequest, withQuery } from "./client";
import type { HuntUpdateRequestStatus, HuntUpdateRequestType } from "./hunt-update-requests";

export type AdminHuntUpdateRequest = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  hunt: { id: string; name: string; slug: string };
  user: { id: string; name: string | null };
};

export type AdminHuntUpdateRequestPage = {
  items: AdminHuntUpdateRequest[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type AdminHuntUpdateRequestQuery = {
  page?: number;
  limit?: number;
  status?: HuntUpdateRequestStatus | "";
  type?: HuntUpdateRequestType | "";
  search?: string;
};

export function listAdminHuntUpdateRequests(query: AdminHuntUpdateRequestQuery = {}) {
  return apiRequest<AdminHuntUpdateRequestPage>(
    withQuery("/admin/hunt-update-requests", {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status || undefined,
      type: query.type || undefined,
      search: query.search || undefined,
    }),
    { auth: true },
  );
}

export function updateAdminHuntUpdateRequest(
  id: string,
  body: { status?: HuntUpdateRequestStatus; adminResponse?: string },
) {
  return apiRequest<AdminHuntUpdateRequest>(`/admin/hunt-update-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    json: body,
  });
}
