# AdMob Rewarded + Rewards (WATCH_AD)

## Flow

1. **Mobile (Premium + JWT):** `POST /ads/admob/rewarded/prepare` → `AdMobRewardSession` + `customData` (session UUID).
2. **Mobile:** loads/shows rewarded ad with `serverSideVerificationOptions.customData = sessionId`.
3. **Google → API:** `GET /ads/admob/ssv?...&signature=...&key_id=...` (no JWT).
4. **API:** ECDSA verify (Google key server) → idempotent `AdMobSsvTransaction` → `RewardsService.recordEvent(WATCH_AD, referenceId=transaction_id)`.

Client reward callbacks are **UX only**; points credit requires SSV.

## Environment (API)

| Variable | Purpose |
|----------|---------|
| `ADMOB_REWARDED_ANDROID_UNIT_ID` | Production rewarded unit (Android) |
| `ADMOB_REWARDED_IOS_UNIT_ID` | Production rewarded unit (iOS) |
| `ADMOB_REWARDED_*_UNIT_IDS` | Optional comma-separated allowlist extension |
| `ADMOB_REWARDED_DAILY_MAX` | Max rewarded SSV credits per user per UTC day (default 30) |
| `ADMOB_REWARDED_COOLDOWN_SECONDS` | Minimum seconds between rewarded credits (default 45) |

Test units are always allowed: `ca-app-pub-3940256099942544/5224354917` (Android), `.../1712485313` (iOS).

## Environment (Mobile / EAS)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob app ID (Android) |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob app ID (iOS) |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_UNIT_ID` | Rewarded unit |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS_UNIT_ID` | Rewarded unit |

Defaults in `app.config.js` use **Google official test IDs** when unset.

Requires **development build** (`expo-dev-client`); not available in Expo Go.

## AdMob Console (external)

1. Create Android + iOS apps in AdMob.
2. Create **Rewarded** ad units per platform.
3. Enable **Server-side verification** on each rewarded unit.
4. Callback URL: `https://<API_HOST>/ads/admob/ssv`
5. Paste production app IDs and ad unit IDs into Render/EAS secrets (not Git).

## Migration

`20261113140000_add_admob_rewarded_ssv` — apply with `prisma migrate deploy`.

## Missions (seed)

- DAILY: Assista 3 anúncios — 30 pts — `WATCH_AD`
- WEEKLY: Assista 5 anúncios — 70 pts — `WATCH_AD`
- MONTHLY: Assista 15 anúncios — 250 pts — `WATCH_AD`

One verified view advances all active `WATCH_AD` missions (per period rules + receipts).

## Status polling

`GET /ads/admob/rewarded/sessions/:sessionId` (JWT + Premium) → `pending` | `confirmed` | `expired`.
