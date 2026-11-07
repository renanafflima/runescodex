import {
  BosstiaryHuntMode,
  CommunityRotationRecommendedLevel,
  CommunityRotationStatus,
} from '../../generated/prisma/client.js';
import type {
  CommunityDurationFilter,
  CommunityLevelFilter,
  CommunityModeFilter,
} from './dto/list-community-rotations-query.dto';

export const PUBLIC_STATUSES: CommunityRotationStatus[] = [
  CommunityRotationStatus.PUBLISHED,
];

/** Stable Rewards event id. Credit only happens if Rewards allowlists this string. */
export const COMMUNITY_ROTATION_PUBLISHED_EVENT =
  'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED';

export const COMMUNITY_ROTATION_LEVEL_LABELS: Record<
  CommunityRotationRecommendedLevel,
  string
> = {
  L300: 'Level 300+',
  L500: 'Level 500+',
  L700: 'Level 700+',
  L1000_PLUS: 'Level 1000+',
};

export function mapLevelFilter(
  level?: CommunityLevelFilter,
): CommunityRotationRecommendedLevel | undefined {
  if (!level || level === 'ALL') {
    return undefined;
  }
  if (level === '300') {
    return CommunityRotationRecommendedLevel.L300;
  }
  if (level === '500') {
    return CommunityRotationRecommendedLevel.L500;
  }
  if (level === '700') {
    return CommunityRotationRecommendedLevel.L700;
  }
  return CommunityRotationRecommendedLevel.L1000_PLUS;
}

export function mapModeFilter(
  mode?: CommunityModeFilter,
): BosstiaryHuntMode | undefined {
  if (!mode || mode === 'ALL') {
    return undefined;
  }
  return mode as BosstiaryHuntMode;
}

export function mapDurationFilter(
  duration?: CommunityDurationFilter,
): number | undefined {
  if (!duration || duration === 'ALL') {
    return undefined;
  }
  return Number(duration);
}
