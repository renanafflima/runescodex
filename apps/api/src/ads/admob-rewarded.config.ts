/** Official Google sample ad unit IDs for development and automated tests. */
export const ADMOB_TEST_REWARDED_ANDROID =
  'ca-app-pub-3940256099942544/5224354917';
export const ADMOB_TEST_REWARDED_IOS =
  'ca-app-pub-3940256099942544/1712485313';

export const ADMOB_REWARD_SESSION_TTL_MS = 15 * 60_000;

export function rewardedAdUnitAllowlist(env: NodeJS.ProcessEnv = process.env) {
  const merged = [
    env.ADMOB_REWARDED_ANDROID_UNIT_ID,
    env.ADMOB_REWARDED_IOS_UNIT_ID,
    env.ADMOB_REWARDED_ANDROID_UNIT_IDS,
    env.ADMOB_REWARDED_IOS_UNIT_IDS,
    ADMOB_TEST_REWARDED_ANDROID,
    ADMOB_TEST_REWARDED_IOS,
  ]
    .flatMap((raw) => (raw ? raw.split(',') : []))
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(merged);
}

export function admobRewardedDailyMax(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.ADMOB_REWARDED_DAILY_MAX ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 30;
}

export function admobRewardedCooldownSeconds(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsed = Number(env.ADMOB_REWARDED_COOLDOWN_SECONDS ?? 45);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 45;
}
