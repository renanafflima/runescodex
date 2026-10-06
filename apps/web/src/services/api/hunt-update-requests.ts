import { apiRequest, withQuery } from "./client";

export const HUNT_UPDATE_REQUEST_TYPES = [
  "XP",
  "PROFIT",
  "LEVEL",
  "VOCATION",
  "CREATURES",
  "LOCATION",
  "LOOT",
  "OTHER",
] as const;

export const HUNT_UPDATE_REQUEST_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] as const;

export type HuntUpdateRequestType = (typeof HUNT_UPDATE_REQUEST_TYPES)[number];
export type HuntUpdateRequestStatus = (typeof HUNT_UPDATE_REQUEST_STATUSES)[number];

export type HuntUpdateRequest = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type HuntUpdateRequestPage = {
  items: HuntUpdateRequest[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export function listHuntUpdateRequests(slug: string, page = 1, limit = 50) {
  return apiRequest<HuntUpdateRequestPage>(
    withQuery(`/hunts/${encodeURIComponent(slug)}/update-requests`, { page, limit }),
    { auth: true },
  );
}

export function createHuntUpdateRequest(slug: string, type: HuntUpdateRequestType, description: string) {
  return apiRequest<HuntUpdateRequest>(`/hunts/${encodeURIComponent(slug)}/update-requests`, {
    method: "POST",
    json: { type, description },
  });
}
