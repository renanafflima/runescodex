export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forumWrite: { limit: 20, windowMs: 60_000 },
  huntCommentWrite: { limit: 20, windowMs: 60_000 },
  ticketWrite: { limit: 20, windowMs: 60_000 },
} as const;
