export const BOSSTIARY_TIME_OPTIONS = [15, 20, 30, 60] as const;
export type BosstiaryTimeOption = (typeof BOSSTIARY_TIME_OPTIONS)[number];

export const BOSSTIARY_LEVEL_BANDS = [300, 500, 700, 1000] as const;

export const BOSSTIARY_ORIGIN_CITIES = [
  'Thais',
  'Edron',
  'Darashia',
  'Venore',
  'Farmine',
  'Yalahar',
] as const;

export const BOSSTIARY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BOSSTIARY_COMMENT_MAX_LENGTH = 1000;
