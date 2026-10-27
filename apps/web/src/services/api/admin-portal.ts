import { apiConfiguration, apiRequest } from "./client";
import { getAccessToken } from "../session";

export type AdminPeriodQuery = {
  preset?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
  huntId?: string;
  creatureId?: string;
  authorId?: string;
  status?: string;
  priority?: string;
  problemType?: string;
  assignee?: string;
  author?: string;
  dateField?: string;
  vocation?: string;
  sort?: string;
  entityType?: string;
  action?: string;
};

export type AdminMetric = {
  key: string;
  label: string;
  definition: string;
  source: string;
  unit: string;
  window: "snapshot" | "period" | "cumulative";
  value: number | null;
  previous: number | null;
  deltaPercent: number | null;
  available: boolean;
  unavailableReason: string | null;
  href: string;
};

export type AdminOverview = {
  period: {
    preset: string;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    grain: string;
    clock: "elapsed";
  };
  coverageStartedAt: string | null;
  viewMeasurement: "none" | "partial" | "full";
  clock: "elapsed";
  metrics: AdminMetric[];
};

function queryString(query: AdminPeriodQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function getAdminOverview(query: AdminPeriodQuery) {
  return apiRequest<AdminOverview>(`/admin/insights/overview${queryString(query)}`);
}

export function getAdminSeries(metric: string, query: AdminPeriodQuery) {
  return apiRequest<{
    metric: string;
    definition: string;
    measurement: "none" | "partial" | "full";
    coverageStartedAt: string | null;
    buckets: Array<{ start: string; value: number | null }>;
  }>(`/admin/insights/series/${metric}${queryString(query)}`);
}

export function getAdminActivity() {
  return apiRequest<{
    items: Array<{ at: string; type: string; title: string; detail: string; href: string }>;
  }>("/admin/insights/activity");
}

export function getAdminAlerts() {
  return apiRequest<{
    clock: "elapsed";
    configured: Record<string, boolean>;
    items: Array<{ id: string; title: string; detail: string; href: string; criterion: string }>;
  }>("/admin/insights/alerts");
}

export function getAdminBadges() {
  return apiRequest<{
    openTickets: number;
    unassigned: number;
    contributions: number;
    redemptions: number;
  }>("/admin/insights/badges");
}

export function getAdminHuntRankings(query: AdminPeriodQuery) {
  return apiRequest<{
    measurement: "none" | "partial" | "full";
    coverageStartedAt: string | null;
    definition: string;
    items: Array<{
      position: number;
      id: string;
      name: string;
      slug: string;
      location: string;
      updatedAt: string;
      createdAt: string;
      views: number | null;
      readers: number | null;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/hunts${queryString(query)}`);
}

export function getAdminHuntQuality(query: AdminPeriodQuery) {
  return apiRequest<{
    definition: string;
    items: Array<{
      id: string;
      name: string;
      slug: string;
      missingDescription: boolean;
      missingMap: boolean;
      missingVocations: boolean;
      missingCreatures: boolean;
      duplicateName: boolean;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/hunt-quality${queryString(query)}`);
}

export function getAdminCreatures(query: AdminPeriodQuery) {
  return apiRequest<{
    items: Array<{
      id: string;
      name: string;
      slug: string;
      updatedAt: string;
      missingBestiary: boolean;
      missingFields: string[];
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/creatures${queryString(query)}`);
}

export function getAdminForum(query: AdminPeriodQuery) {
  return apiRequest<{
    definition: string;
    topicsTotal: number;
    topics: number;
    repliesTotal: number;
    replies: number;
    unanswered: number;
    authors: number;
    responders: number;
  }>(`/admin/insights/forum${queryString(query)}`);
}

export function getAdminUsers(query: AdminPeriodQuery) {
  return apiRequest<{
    items: Array<{
      id: string;
      role: string;
      createdAt: string;
      name: string | null;
      level: number | null;
      vocation: string | null;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/users${queryString(query)}`);
}

export function getAdminUser(id: string) {
  return apiRequest<{
    id: string;
    email: string;
    role: string;
    createdAt: string;
    character: { name: string; level: number; vocation: string; world: string } | null;
    wallet: { points: number; gold: number; diamond: number } | null;
    forumThreads: number;
    forumReplies: number;
    contributions: number;
    tickets: number;
    openTickets: number;
    activeSessions: number;
    devices?: Array<{
      id: string;
      label: string;
      deviceType: string | null;
      osName: string | null;
      clientName: string | null;
      status: string;
      createdAt: string;
      lastSeenAt: string;
      revokedAt: string | null;
    }>;
    licenses: Array<{
      id: string;
      status: string;
      source: string;
      term: string;
      expiresAt: string | null;
      grantedAt: string;
      payments: Array<{
        id: string;
        status: string;
        amountMinor: number;
        currency: string;
        providerPaymentId: string | null;
        createdAt: string;
      }>;
    }>;
    recentTickets: Array<{
      id: string;
      protocol: string;
      status: string;
      priority: string;
      createdAt: string;
    }>;
  }>(`/admin/insights/users/${id}`);
}

export function searchAdmin(q: string) {
  return apiRequest<{
    items: Array<{ type: "user" | "creature" | "hunt" | "ticket"; id: string; label: string; href: string }>;
  }>(`/admin/insights/search?q=${encodeURIComponent(q)}`);
}

export function getAdminRankings(dimension: string, query: AdminPeriodQuery) {
  return apiRequest<{
    definition: string;
    items: Array<{
      position: number;
      id: string;
      label: string;
      value: number;
      previous?: number;
      deltaPercent?: number | null;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/rankings/${dimension}${queryString(query)}`);
}

export function getAdminSearchMisses(query: AdminPeriodQuery) {
  return apiRequest<{
    definition: string;
    items: Array<{ term: string; category: string; value: number }>;
  }>(`/admin/insights/search-misses${queryString(query)}`);
}

export function getAdminTickets(query: AdminPeriodQuery) {
  return apiRequest<{
    items: Array<{
      id: string;
      protocol: string;
      status: string;
      priority: string;
      problemType: string;
      origin: string;
      subject: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
      author: { id: string; name: string | null };
      assignee: { id: string; name: string | null } | null;
      hunt: { id: string; name: string; slug: string } | null;
      creature: { id: string; name: string; slug: string } | null;
    }>;
    page: number;
    total: number;
    limit: number;
    summary?: {
      scope: "snapshot";
      definition: string;
      statuses: Record<string, number>;
      priorities: Record<string, number>;
    };
  }>(`/admin/tickets${queryString(query)}`);
}

export function getAdminHuntCatalog(query: AdminPeriodQuery) {
  return apiRequest<{
    items: Array<{
      id: string;
      name: string;
      slug: string;
      location: string | null;
      updatedAt: string;
      vocations: Array<{ vocation: string; levelMin: number; xpPerHour: number; profitPerHour: number }>;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/hunt-catalog${queryString(query)}`);
}

export function getAdminForumThreads(query: AdminPeriodQuery) {
  return apiRequest<{
    items: Array<{
      id: string;
      title: string;
      category: string | null;
      createdAt: string;
      replies: number;
      author: string | null;
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/insights/forum-threads${queryString(query)}`);
}

export function getAdminBossViews(query: AdminPeriodQuery) {
  return apiRequest<{
    definition: string;
    measurement: "none" | "partial" | "full";
    coverageStartedAt: string | null;
    items: Array<{ slug: string; views: number }>;
  }>(`/admin/insights/boss-views${queryString(query)}`);
}

export type AdminTicketDetail = {
  id: string;
  protocol: string;
  status: string;
  priority: string;
  urgentReason: string | null;
  problemType: string;
  impact: string;
  origin: string;
  description: string;
  catalogValue: string | null;
  userValue: string | null;
  playerLevel: number | null;
  partyFormat: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  contentAppliedAt: string | null;
  resolvedAt: string | null;
  author: { id: string; name: string | null };
  assignee: { id: string; name: string | null } | null;
  vocations: string[];
  hunt: {
    id: string;
    name: string;
    slug: string;
    location: string;
    subLocation: string | null;
    difficulty: string;
    description: string | null;
    isActive: boolean;
    vocations: Array<{
      vocation: string;
      levelMin: number;
      levelMax: number | null;
      xpPerHour: number;
      profitPerHour: number;
    }>;
  } | null;
  creature: {
    id: string;
    name: string;
    slug: string;
    image: string;
    hp: number | null;
    experience: number | null;
    difficulty: string | null;
    description: string | null;
  } | null;
  evidences: Array<{
    id: string;
    mimeType: string;
    source: string;
    byteSize: number | null;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    visibility: "PUBLIC" | "INTERNAL";
    body: string;
    createdAt: string;
    author: { id: string; name: string | null };
  }>;
};

export function getAdminTicket(id: string) {
  return apiRequest<AdminTicketDetail>(`/admin/tickets/${id}`);
}

export function getAdminStaff() {
  return apiRequest<Array<{ id: string; name: string | null }>>("/admin/tickets/staff");
}

export function postAdminTicketMessage(
  id: string,
  body: { visibility: "PUBLIC" | "INTERNAL"; body: string; expectedUpdatedAt: string },
) {
  return apiRequest(`/admin/tickets/${id}/messages`, { method: "POST", json: body });
}

export function patchAdminTicketAssignment(
  id: string,
  body: { assigneeId: string | null; expectedUpdatedAt: string },
) {
  return apiRequest(`/admin/tickets/${id}/assignment`, { method: "PATCH", json: body });
}

export function patchAdminTicketPriority(
  id: string,
  body: { priority: string; urgentReason?: string; expectedUpdatedAt: string },
) {
  return apiRequest(`/admin/tickets/${id}/priority`, { method: "PATCH", json: body });
}

export function patchAdminTicketStatus(
  id: string,
  body: { status: string; resolutionNote?: string; expectedUpdatedAt: string },
) {
  return apiRequest(`/admin/tickets/${id}/status`, { method: "PATCH", json: body });
}

export function postAdminTicketReopen(id: string, reason: string) {
  return apiRequest(`/admin/tickets/${id}/reopen`, { method: "POST", json: { reason } });
}

export function postAdminTicketApply(id: string, expectedUpdatedAt: string) {
  return apiRequest<{ alreadyApplied: boolean; appliedAt: string; updated?: number }>(
    `/admin/tickets/${id}/apply-correction`,
    { method: "POST", json: { expectedUpdatedAt } },
  );
}

export function getAdminSettings() {
  return apiRequest<{
    clock: "elapsed";
    items: Array<{
      key: string;
      label: string;
      definition: string;
      unit: string;
      min: number;
      max: number;
      amount: number | null;
      updatedAt: string | null;
    }>;
  }>("/admin/settings");
}

export function saveAdminSetting(key: string, amount: number) {
  return apiRequest(`/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    json: { amount },
  });
}

export function removeAdminSetting(key: string) {
  return apiRequest(`/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
}

export function getAdminAudit(query: AdminPeriodQuery & { action?: string; entityType?: string }) {
  return apiRequest<{
    items: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      summary: string;
      createdAt: string;
      actor: { id: string; name: string | null };
    }>;
    page: number;
    total: number;
    limit: number;
  }>(`/admin/audit${queryString(query)}`);
}

export function getAdminRedemptions() {
  return apiRequest<{
    counts: Record<string, number>;
    items: Array<{
      id: string;
      status: string;
      currency: string;
      price: number;
      quantity: number;
      createdAt: string;
      user: { id: string; email: string } | null;
      reward: { id: string; name: string } | null;
    }>;
  }>("/admin/rewards/redemptions");
}

export function postAdminRedemption(id: string, action: "approve" | "deliver" | "cancel", note: string) {
  const json =
    action === "cancel"
      ? { cancellationReason: note }
      : action === "deliver"
        ? { deliveryNote: note }
        : { adminNote: note };
  return apiRequest(`/admin/rewards/redemptions/${id}/${action}`, { method: "POST", json });
}

const viewed = new Set<string>();

export function viewSessionKey() {
  const key = "rc_view_session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function recordContentView(subject: "HUNT" | "CREATURE" | "BOSS", subjectId: string) {
  if (!subjectId) return;
  const mark = `${subject}:${subjectId}`;
  if (viewed.has(mark)) return;
  viewed.add(mark);
  void apiRequest("/analytics/views", {
    method: "POST",
    json: { subject, subjectId, sessionKey: viewSessionKey() },
  }).catch(() => {
    viewed.delete(mark);
  });
}

const reportedMisses = new Set<string>();

export function recordSearchMiss(term: string) {
  const normalized = term.trim().toLocaleLowerCase();
  if (normalized.length < 2 || reportedMisses.has(normalized)) return;
  reportedMisses.add(normalized);
  void apiRequest("/analytics/search-misses", {
    method: "POST",
    json: { term: normalized, category: "HUNT_CLIENT" },
  }).catch(() => {
    reportedMisses.delete(normalized);
  });
}

export async function openTicketEvidence(ticketId: string, evidenceId: string) {
  const token = getAccessToken();
  const response = await fetch(
    `${apiConfiguration.baseUrl}/tickets/${ticketId}/evidence/${evidenceId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) {
    throw new Error("Não foi possível abrir a evidência.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
