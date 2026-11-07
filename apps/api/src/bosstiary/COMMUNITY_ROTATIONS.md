# Bosstiário — Rotações da Comunidade

Rotations published by players live in `CommunityRotation*` tables. They are separate from
algorithmic planner rows (`BosstiaryRotation` + `rotation-planner.ts`).

## API (Premium + JWT)

Base path: `/bosstiary/community/rotations`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Feed with filters (`level`, `mode`, `duration`, `sort`, `search`, pagination) |
| GET | `/ranking` | Weekly top by likes (UTC week), published only |
| GET | `/:id` | Detail (authors/admins may read `REMOVED`) |
| POST | `/` | Publish rotation (min. 1 boss; rewards event on first successful create) |
| PATCH | `/:id` | Author or admin |
| DELETE | `/:id` | Author or admin — sets status `REMOVED` (engagement rows kept) |
| POST/DELETE | `/:id/like` | Toggle like (published only) |
| POST/DELETE | `/:id/favorite` | Toggle favorite (published only) |
| GET/POST | `/:id/comments` | Threaded comments |
| PATCH/DELETE | `/:id/comments/:commentId` | Author |
| POST/DELETE | `/:id/comments/:commentId/like` | Comment like |
| GET/POST | `/:id/tests` | Community test reports |

### Idempotent publish

Clients **should** send header `Idempotency-Key` (max 128 chars) on `POST /`.
The same user + key + payload returns the original rotation without a second insert or reward
event. Reusing the key with a different body returns `409 Conflict`. Older clients without
the header keep the previous behaviour (no server-side deduplication).

Concurrency is serialized per user/key via PostgreSQL advisory locks inside the transaction.

### Boss list rules

- Unique `position` per rotation.
- Each stop requires `bossId` or `bossName` (pending).
- The same `bossId` cannot appear twice.
- Pending names are trimmed; duplicates are rejected case-insensitively (no DB unique on
  pending names).

## Rewards

On successful publish, `RewardsService.recordEvent` fires
`BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` with `referenceId` = rotation id (idempotent per
mission period). Seed mission: **Publique uma Rotação** (WEEKLY, +80 pts). Idempotent
replays via `Idempotency-Key` do not call `recordEvent` again.

## Ranking performance

Feed cards mark “Destaque” using `weeklyFeaturedRotationIds(3)` — a lightweight `groupBy`
on weekly likes only. Full card payloads for ranking previews use `GET /ranking` or
`rankingPreview` on the list query.

## Migrations

| Migration | Purpose |
|-----------|---------|
| `20261107120000_add_community_rotations` | Core tables |
| `20261107143000_community_rotation_publish_idempotency` | `Idempotency-Key` storage |
| `20261107143500_drop_community_rotation_sort_enum` | Drops unused `CommunityRotationSort` PG enum |

Apply with `prisma migrate deploy` after review.

### PostgreSQL integration tests

```powershell
cd apps/api
npx prisma migrate deploy
$env:RUN_COMMUNITY_ROTATIONS_PG = "1"
npm test -- community-rotations.pg.spec.ts
```

Skip in CI unless `RUN_COMMUNITY_ROTATIONS_PG=1` and a dev `DATABASE_URL` with migrations applied.
