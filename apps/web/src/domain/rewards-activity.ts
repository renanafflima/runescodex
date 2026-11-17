import { trackRewardActivity } from "../services/api/rewards";

/** Fire-and-forget authenticated activity for Rewards missions (deduped server-side). */
export function reportRewardActivity(
  eventType: string,
  referenceId: string,
  referenceType?: string,
) {
  if (!eventType || !referenceId) return;
  void trackRewardActivity(eventType, referenceId, referenceType).catch(() => undefined);
}