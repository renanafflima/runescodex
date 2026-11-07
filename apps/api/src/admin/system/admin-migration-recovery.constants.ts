/**
 * TEMPORARY: controlled production migration recovery via admin API.
 * Remove this module after Prisma history is regularized on Neon.
 */

export const MIGRATION_RECOVERY_TEMPORARY_NOTE =
  'Temporary admin-only migration recovery. Remove after production Prisma history is regularized. Uses the service DATABASE_URL only; never accepts credentials in requests.';

/** Chronological allowlist — one step per POST execute. */
export const MIGRATION_RECOVERY_ALLOWLIST = [
  '20261103000000_hunt_vocation_multiple_level_ranges',
  '20261103120000_hunt_update_request_vocation_range',
  '20261103143000_billing_checkout_attempt',
  '20261104090000_add_bosstiary',
  '20261107120000_add_community_rotations',
  '20261107143000_community_rotation_publish_idempotency',
  '20261107143500_drop_community_rotation_sort_enum',
] as const;

export type MigrationRecoveryStepName =
  (typeof MIGRATION_RECOVERY_ALLOWLIST)[number];

export const MIGRATION_RECOVERY_ADVISORY_LOCK_KEY = 87_879_001;

export const BOSSTIARY_TABLES = [
  'BosstiaryBoss',
  'BosstiaryBossVocation',
  'BosstiaryTravelEdge',
  'BosstiaryRotation',
  'BosstiaryRotationStop',
  'BosstiaryComment',
  'BosstiaryCommentLike',
] as const;

export const BOSSTIARY_ENUMS = [
  'BosstiaryHuntMode',
  'BosstiaryAccessStatus',
  'BosstiaryRotationKind',
] as const;

export const COMMUNITY_TABLES = [
  'CommunityRotation',
  'CommunityRotationBoss',
  'CommunityRotationLike',
  'CommunityRotationFavorite',
  'CommunityRotationComment',
  'CommunityRotationCommentLike',
  'CommunityRotationTest',
] as const;

export const COMMUNITY_ENUMS = [
  'CommunityRotationStatus',
  'CommunityRotationRecommendedLevel',
] as const;

/** Required before resolve-only on billing checkout attempt migration. */
export const BILLING_CHECKOUT_ATTEMPT_INDEXES = [
  'BillingCheckoutAttempt_idempotencyKey_key',
  'BillingCheckoutAttempt_billingPaymentId_key',
  'BillingCheckoutAttempt_orderId_generation_key',
  'BillingCheckoutAttempt_userId_state_idx',
  'BillingCheckoutAttempt_orderId_idx',
  'BillingCheckoutAttempt_leaseExpiresAt_idx',
  'BillingCheckoutAttempt_state_updatedAt_idx',
  'BillingCheckoutAttempt_one_active_per_user_key',
] as const;

export const COMMUNITY_PUBLISH_IDEMPOTENCY_INDEXES = [
  'CommunityRotationPublishIdempotency_userId_idempotencyKey_key',
  'CommunityRotationPublishIdempotency_rotationId_key',
] as const;
