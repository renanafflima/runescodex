import { trackRewardActivity } from "../services/api/rewards";

/**
 * Events that intentionally count repeated user actions within a period.
 * Distinct-entity events (creature/hunt/boss views) keep a stable referenceId.
 */
const REPEATABLE_ACTIVITY = new Set([
  "BOSSTIARY_OPENED",
  "BESTIARY_FILTER_USED",
  "SHARE_LINK_CLICKED",
  "PROMO_BANNER_OPENED",
]);

/** Fire-and-forget authenticated activity for Rewards missions (deduped server-side). */
export function reportRewardActivity(
  eventType: string,
  referenceId: string,
  referenceType?: string,
) {
  if (!eventType || !referenceId) return;
  const uniqueRef = REPEATABLE_ACTIVITY.has(eventType)
    ? `${referenceId}:${crypto.randomUUID()}`
    : referenceId;
  void trackRewardActivity(eventType, uniqueRef, referenceType).catch(() => undefined);
}
