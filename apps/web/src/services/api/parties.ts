import { apiRequest, withQuery } from "./client";
import type { CommunityRotationCard } from "./community-rotations";
import { readPage, type PageResult } from "./page";

export type PartyStatus = "ACTIVE" | "ARCHIVED";
export type PartyMemberRole = "LEADER" | "OFFICER" | "MEMBER";
export type PartyInvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
export type HuntSessionStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type PartyMember = {
  id: string;
  userId: string;
  role: PartyMemberRole;
  status: string;
  joinedAt: string;
  name: string;
  vocation: string | null;
  level: number | null;
  avatar: string;
};

export type PartySummary = {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  status: PartyStatus;
  isPrivate: boolean;
  myRole: PartyMemberRole | null;
  memberCount: number;
  members: PartyMember[];
  createdAt: string;
};

export type PartyInvitation = {
  id: string;
  partyId: string;
  partyName: string;
  email: string;
  status: PartyInvitationStatus;
  expiresAt: string;
  createdAt: string;
  awaitingAccount: boolean;
};

export type HuntSession = {
  id: string;
  partyId: string;
  title: string;
  description: string | null;
  rotationId: string | null;
  rotationTitle: string | null;
  rotationRemoved: boolean;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: HuntSessionStatus;
  participants: Array<{
    id: string;
    userId: string;
    status: string;
    name: string;
    vocation: string | null;
    level: number | null;
  }>;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  partyId: string | null;
  sessionId: string | null;
  readAt: string | null;
  createdAt: string;
};

const BASE = "/bosstiary/parties";

export async function listMyParties() {
  return readPage(await apiRequest(withQuery(BASE, { limit: 20 }))) as PageResult<PartySummary>;
}

export function createParty(payload: { name: string; description?: string; isPrivate?: boolean }) {
  return apiRequest<PartySummary>(BASE, { method: "POST", json: payload });
}

export function getParty(id: string) {
  return apiRequest<PartySummary>(`${BASE}/${encodeURIComponent(id)}`);
}

export function updateParty(id: string, payload: { name?: string; description?: string | null }) {
  return apiRequest<PartySummary>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", json: payload });
}

export function archiveParty(id: string) {
  return apiRequest<PartySummary>(`${BASE}/${encodeURIComponent(id)}/archive`, { method: "POST" });
}

export function leaveParty(id: string) {
  return apiRequest(`${BASE}/${encodeURIComponent(id)}/leave`, { method: "POST" });
}

export function transferPartyLeader(id: string, userId: string) {
  return apiRequest<PartySummary>(`${BASE}/${encodeURIComponent(id)}/leader`, {
    method: "POST",
    json: { userId },
  });
}

export function invitePartyMember(id: string, email: string) {
  return apiRequest<PartyInvitation>(`${BASE}/${encodeURIComponent(id)}/invitations`, {
    method: "POST",
    json: { email },
  });
}

export function removePartyMember(id: string, userId: string) {
  return apiRequest(`${BASE}/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function listReceivedPartyInvites() {
  return readPage(await apiRequest(`${BASE}/invitations/received`)) as PageResult<PartyInvitation>;
}

export async function listSentPartyInvites() {
  return readPage(await apiRequest(`${BASE}/invitations/sent`)) as PageResult<PartyInvitation>;
}

export function acceptPartyInvite(id: string) {
  return apiRequest<PartySummary>(`${BASE}/invitations/${encodeURIComponent(id)}/accept`, {
    method: "POST",
  });
}

export function declinePartyInvite(id: string) {
  return apiRequest(`${BASE}/invitations/${encodeURIComponent(id)}/decline`, { method: "POST" });
}

export function cancelPartyInvite(partyId: string, invitationId: string) {
  return apiRequest(
    `${BASE}/${encodeURIComponent(partyId)}/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" },
  );
}

export async function listPartyRotations(partyId: string) {
  return readPage(
    await apiRequest(withQuery(`${BASE}/${encodeURIComponent(partyId)}/rotations`, { limit: 20 })),
  ) as PageResult<CommunityRotationCard>;
}

export async function listHuntSessions(partyId: string) {
  return readPage(await apiRequest(`${BASE}/${encodeURIComponent(partyId)}/sessions`)) as PageResult<HuntSession>;
}

export function createHuntSession(
  partyId: string,
  payload: { title: string; description?: string; rotationId?: string; plannedAt?: string; participantIds?: string[] },
) {
  return apiRequest<HuntSession>(`${BASE}/${encodeURIComponent(partyId)}/sessions`, {
    method: "POST",
    json: payload,
  });
}

export function getHuntSession(partyId: string, sessionId: string) {
  return apiRequest<HuntSession>(
    `${BASE}/${encodeURIComponent(partyId)}/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export function startHuntSession(partyId: string, sessionId: string) {
  return apiRequest<HuntSession>(
    `${BASE}/${encodeURIComponent(partyId)}/sessions/${encodeURIComponent(sessionId)}/start`,
    { method: "POST" },
  );
}

export function completeHuntSession(partyId: string, sessionId: string) {
  return apiRequest<HuntSession>(
    `${BASE}/${encodeURIComponent(partyId)}/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" },
  );
}

export function cancelHuntSession(partyId: string, sessionId: string) {
  return apiRequest<HuntSession>(
    `${BASE}/${encodeURIComponent(partyId)}/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  );
}

export function addHuntSessionParticipant(partyId: string, sessionId: string, userId: string) {
  return apiRequest<HuntSession>(
    `${BASE}/${encodeURIComponent(partyId)}/sessions/${encodeURIComponent(sessionId)}/participants`,
    { method: "POST", json: { userId } },
  );
}

export async function listPartyActivities(partyId: string, sessionId?: string) {
  return readPage(
    await apiRequest(withQuery(`${BASE}/${encodeURIComponent(partyId)}/activities`, { sessionId })),
  );
}

export async function listPartyNotifications() {
  return readPage(await apiRequest(`${BASE}/notifications`)) as PageResult<AppNotification>;
}

export function markPartyNotificationRead(id: string) {
  return apiRequest(`${BASE}/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}
