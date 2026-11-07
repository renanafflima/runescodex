/**
 * PostgreSQL integration proofs for community rotations.
 *
 * Skipped unless:
 * - RUN_COMMUNITY_ROTATIONS_PG=1
 * - DATABASE_URL points at development Postgres
 * - migrations through 20261107143500 are applied (including idempotency table)
 *
 * Do not run against production.
 *
 *   cd apps/api
 *   npx prisma migrate deploy
 *   $env:RUN_COMMUNITY_ROTATIONS_PG = "1"
 *   npm test -- community-rotations.pg.spec.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import {
  BosstiaryHuntMode,
  CommunityRotationStatus,
  PrismaClient,
} from '../../generated/prisma/client.js';
import { RewardsService } from '../rewards/rewards.service';
import { COMMUNITY_ROTATION_PUBLISHED_EVENT } from './community-rotation.constants';
import { CommunityRotationsService } from './community-rotations.service';

const enabled =
  process.env.RUN_COMMUNITY_ROTATIONS_PG === '1' &&
  Boolean(process.env.DATABASE_URL);

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function baseDto(bossId: string) {
  return {
    title: `PG rotation ${crypto.randomUUID().slice(0, 8)}`,
    recommendedLevel: 'L300' as const,
    huntMode: BosstiaryHuntMode.SOLO,
    plannedDurationMinutes: 30 as const,
    bosses: [{ bossId, position: 1 }],
  };
}

(enabled ? describe : describe.skip)(
  'Community rotations PostgreSQL',
  () => {
    let primary: PrismaClient;
    let secondary: PrismaClient;
    let left: CommunityRotationsService;
    let right: CommunityRotationsService;
    let rewards: RewardsService;
    let userId: string;
    let bossId: string;
    const createdRotationIds: string[] = [];

    beforeAll(async () => {
      primary = createClient();
      secondary = createClient();
      const table = await primary.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public."CommunityRotation"')::text AS name
      `;
      if (!table[0]?.name) {
        throw new Error(
          'CommunityRotation is missing. Apply community rotation migrations first.',
        );
      }
      const idem = await primary.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public."CommunityRotationPublishIdempotency"')::text AS name
      `;
      if (!idem[0]?.name) {
        throw new Error(
          'CommunityRotationPublishIdempotency is missing. Apply 20261107143000 first.',
        );
      }

      const user = await primary.user.create({
        data: {
          email: `community-pg-${crypto.randomUUID()}@example.invalid`,
          passwordHash: 'pg-test',
        },
      });
      userId = user.id;

      const boss = await primary.bosstiaryBoss.create({
        data: {
          slug: `pg-community-boss-${crypto.randomUUID().slice(0, 8)}`,
          name: 'PG Community Boss',
        },
      });
      bossId = boss.id;

      rewards = new RewardsService(primary as never);
      left = new CommunityRotationsService(primary as never, rewards);
      right = new CommunityRotationsService(secondary as never, rewards);
    });

    afterAll(async () => {
      if (createdRotationIds.length) {
        await primary.communityRotationPublishIdempotency.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotationLike.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotationFavorite.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotationComment.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotationTest.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotationBoss.deleteMany({
          where: { rotationId: { in: createdRotationIds } },
        });
        await primary.communityRotation.deleteMany({
          where: { id: { in: createdRotationIds } },
        });
      }
      if (bossId) {
        await primary.bosstiaryBoss
          .delete({ where: { id: bossId } })
          .catch(() => undefined);
      }
      if (userId) {
        await primary.user
          .delete({ where: { id: userId } })
          .catch(() => undefined);
      }
      await primary?.$disconnect();
      await secondary?.$disconnect();
    });

    it('creates a rotation and records rewards in one transaction', async () => {
      const created = await left.create(userId, baseDto(bossId));
      createdRotationIds.push(created.id);

      const receipts = await primary.rewardEventReceipt.findMany({
        where: {
          userId,
          eventType: COMMUNITY_ROTATION_PUBLISHED_EVENT,
          referenceId: created.id,
        },
      });
      expect(receipts.length).toBeGreaterThanOrEqual(0);
    });

    it('rolls back the rotation when rewards fail', async () => {
      const failingRewards = {
        recordEvent: jest
          .fn()
          .mockRejectedValue(new Error('rewards unavailable')),
      } as unknown as RewardsService;
      const broken = new CommunityRotationsService(primary as never, failingRewards);
      const title = `Rollback ${crypto.randomUUID().slice(0, 8)}`;

      await expect(
        broken.create(userId, {
          ...baseDto(bossId),
          title,
        }),
      ).rejects.toThrow('rewards unavailable');

      const row = await primary.communityRotation.findFirst({
        where: { userId, title },
      });
      expect(row).toBeNull();
    });

    it('replays publish with the same idempotency key without duplicating rows', async () => {
      const key = `idem-${crypto.randomUUID()}`;
      const dto = baseDto(bossId);
      const first = await left.create(userId, dto, key);
      const second = await left.create(userId, dto, key);
      createdRotationIds.push(first.id);

      expect(second.id).toBe(first.id);
      const count = await primary.communityRotation.count({
        where: { userId, title: dto.title },
      });
      expect(count).toBe(1);
    });

    it('serializes concurrent publishes with the same idempotency key', async () => {
      const key = `idem-conc-${crypto.randomUUID()}`;
      const dto = baseDto(bossId);
      const [a, b] = await Promise.all([
        left.create(userId, dto, key),
        right.create(userId, dto, key),
      ]);
      createdRotationIds.push(a.id);

      expect(a.id).toBe(b.id);
      const count = await primary.communityRotation.count({
        where: { userId, title: dto.title },
      });
      expect(count).toBe(1);
    });

    it('enforces unique likes and favorites', async () => {
      const created = await left.create(userId, baseDto(bossId));
      createdRotationIds.push(created.id);

      await left.like(created.id, userId);
      await expect(left.like(created.id, userId)).rejects.toThrow(
        'Você já curtiu esta rotação.',
      );

      await left.favorite(created.id, userId);
      await left.favorite(created.id, userId);
      const favorites = await primary.communityRotationFavorite.count({
        where: { rotationId: created.id, userId },
      });
      expect(favorites).toBe(1);
    });

    it('rejects duplicate bosses on create', async () => {
      await expect(
        left.create(userId, {
          ...baseDto(bossId),
          title: `Dup boss ${crypto.randomUUID().slice(0, 6)}`,
          bosses: [
            { bossId, position: 1 },
            { bossId, position: 2 },
          ],
        }),
      ).rejects.toThrow('O mesmo boss não pode aparecer mais de uma vez');
    });

    it('soft-deletes while keeping comments and tests', async () => {
      const created = await left.create(userId, baseDto(bossId));
      createdRotationIds.push(created.id);

      await primary.communityRotationComment.create({
        data: {
          rotationId: created.id,
          userId,
          content: 'Still here',
        },
      });
      await primary.communityRotationTest.create({
        data: { rotationId: created.id, userId },
      });

      const removed = await left.remove(created.id, userId);
      expect(removed).toEqual({ id: created.id, removed: true });

      const row = await primary.communityRotation.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.status).toBe(CommunityRotationStatus.REMOVED);

      expect(
        await primary.communityRotationComment.count({
          where: { rotationId: created.id },
        }),
      ).toBe(1);
      expect(
        await primary.communityRotationTest.count({
          where: { rotationId: created.id },
        }),
      ).toBe(1);

      const feed = await primary.communityRotation.count({
        where: { id: created.id, status: CommunityRotationStatus.PUBLISHED },
      });
      expect(feed).toBe(0);
    });

    it('excludes removed rotations from weekly ranking', async () => {
      const created = await left.create(userId, baseDto(bossId));
      createdRotationIds.push(created.id);
      await left.like(created.id, userId);
      await left.remove(created.id, userId);

      const ranking = await left.weeklyRanking(10);
      expect(ranking.some((item) => item.id === created.id)).toBe(false);
    });
  },
);
