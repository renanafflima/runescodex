export const PARTY_LIMITS = {
  maxMembers: 10,
  maxActivePartiesPerUser: 8,
  invitationExpiryDays: 14,
  maxPendingInvitesPerDay: 15,
  nameMax: 80,
  nameMin: 2,
  descriptionMax: 2000,
  sessionTitleMax: 120,
  sessionDescriptionMax: 4000,
  notificationTitleMax: 120,
  notificationBodyMax: 400,
} as const;

export const PARTY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
