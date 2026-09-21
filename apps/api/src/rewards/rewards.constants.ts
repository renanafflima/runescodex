/**
 * Approved Points → Gold packages.
 * Gold → Diamond remains unset until a commercial rate is approved.
 */
export const POINTS_TO_GOLD_PACKAGES = {
  1: { pointsCost: 10_000, goldGranted: 1 },
  5: { pointsCost: 45_000, goldGranted: 5 },
} as const;

export type PointsToGoldAmount = keyof typeof POINTS_TO_GOLD_PACKAGES;

export const GOLD_TO_DIAMOND_RATE: {
  goldCost: number;
  diamondGranted: number;
} | null = null;

export const UNCONFIGURED_PRICE = 0;

export const MISSION_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type MissionPeriod = (typeof MISSION_PERIODS)[number];

export type RewardCurrencyCode = 'GOLD' | 'DIAMOND';

/** Events actually emitted by existing product features. */
export const REWARD_EVENTS = {
  FORUM_TOPIC_CREATED: 'FORUM_TOPIC_CREATED',
  FORUM_COMMENT_CREATED: 'FORUM_COMMENT_CREATED',
} as const;

export type RewardEventType =
  (typeof REWARD_EVENTS)[keyof typeof REWARD_EVENTS];

/** Reserved for future features. recordEvent rejects them until implemented. */
export const FUTURE_REWARD_EVENTS = {
  BESTIARY_ACTION: 'BESTIARY_ACTION',
  HUNT_ACTION: 'HUNT_ACTION',
  MUSIC_COMPLETED: 'MUSIC_COMPLETED',
  PROMOTION_COMPLETED: 'PROMOTION_COMPLETED',
  REFERRAL_CONFIRMED: 'REFERRAL_CONFIRMED',
  KNOWLEDGE_ANSWERED: 'KNOWLEDGE_ANSWERED',
  EXPLORATION_COMPLETED: 'EXPLORATION_COMPLETED',
} as const;

const SUPPORTED_EVENTS = new Set<string>(Object.values(REWARD_EVENTS));

export function isSupportedRewardEvent(
  eventType: string,
): eventType is RewardEventType {
  return SUPPORTED_EVENTS.has(eventType);
}
