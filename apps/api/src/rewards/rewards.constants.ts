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

export {
  CLIENT_TRACKABLE_EVENTS,
  IMPLEMENTED_REWARD_EVENTS,
  REWARD_EVENTS,
  isImplementedRewardEvent,
  isSupportedRewardEvent,
  type RewardEventType,
} from './rewards.events';

/** Legacy reserved names kept for seed/history compatibility (not accepted by recordEvent). */
export const FUTURE_REWARD_EVENTS = {
  BESTIARY_ACTION: 'BESTIARY_ACTION',
  HUNT_ACTION: 'HUNT_ACTION',
  MUSIC_COMPLETED: 'MUSIC_COMPLETED',
  PROMOTION_COMPLETED: 'PROMOTION_COMPLETED',
  REFERRAL_CONFIRMED: 'REFERRAL_CONFIRMED',
  KNOWLEDGE_ANSWERED: 'KNOWLEDGE_ANSWERED',
  EXPLORATION_COMPLETED: 'EXPLORATION_COMPLETED',
} as const;

export const MISSION_ROLES = {
  LEGACY: 'LEGACY',
  POOL: 'POOL',
  FIXED_ADS: 'FIXED_ADS',
  FIXED_WEEKLY_STREAK: 'FIXED_WEEKLY_STREAK',
  FIXED_MONTHLY_STREAK: 'FIXED_MONTHLY_STREAK',
} as const;
