import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth/auth.service';
import { BestiaryService } from './bestiary/bestiary.service';
import { ForumService } from './forum/forum.service';
import { PrismaService } from './prisma/prisma.service';
import { RewardsService } from './rewards/rewards.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(async () => 'hashed'),
  compare: jest.fn(),
}));

function uniqueError() {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  });
}

function createLock() {
  let tail = Promise.resolve();
  return function locked<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = tail.then(fn, fn);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

describe('concurrent writes', () => {
  it('keeps both mission increments and pays the reward once', async () => {
    const state = {
      progress: 0,
      completed: false,
      points: 0,
      ledger: 0,
      receipts: new Set<string>(),
      created: false,
    };
    const progressLock = createLock();
    const prisma = {
      $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      rewardMission: {
        findMany: async () => [
          {
            id: 'mission-1',
            title: 'Comentários',
            description: 'Faça 3 comentários',
            category: 'COMMUNITY',
            period: 'DAILY',
            target: 2,
            pointsReward: 25,
            imageKey: 'missionForum',
            eventType: 'FORUM_COMMENT_CREATED',
            active: true,
          },
        ],
      },
      rewardEventReceipt: {
        createMany: async ({
          data,
        }: {
          data: Array<{ referenceId: string }>;
        }) => {
          const referenceId = data[0].referenceId;
          if (state.receipts.has(referenceId)) return { count: 0 };
          state.receipts.add(referenceId);
          return { count: 1 };
        },
      },
      rewardWallet: {
        findUnique: async () => ({
          id: 'wallet-1',
          userId: 'user-1',
          points: state.points,
          gold: 0,
          diamond: 0,
          updatedAt: new Date(),
        }),
        update: async ({
          data,
        }: {
          data: { points: { increment: number } };
        }) => {
          state.points += data.points.increment;
          return {
            id: 'wallet-1',
            points: state.points,
            gold: 0,
            diamond: 0,
          };
        },
      },
      userMissionProgress: {
        findUnique: async () =>
          state.created
            ? {
                id: 'progress-1',
                progress: state.progress,
                completed: state.completed,
                completedAt: null,
              }
            : null,
        createMany: async () => {
          if (state.created) return { count: 0 };
          state.created = true;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({
          id: 'progress-1',
          progress: state.progress,
          completed: state.completed,
          completedAt: state.completed ? new Date() : null,
        }),
        updateMany: (args: {
          where: { progress?: { lt: number }; completed?: boolean };
          data: {
            progress?: { increment: number };
            completed?: boolean;
          };
        }) =>
          progressLock(async () => {
            if (
              args.where.progress?.lt != null &&
              state.progress >= args.where.progress.lt
            ) {
              return { count: 0 };
            }
            if (args.where.completed === false && state.completed) {
              return { count: 0 };
            }
            if (args.data.progress?.increment) {
              state.progress += args.data.progress.increment;
            }
            if (args.data.completed) state.completed = true;
            return { count: 1 };
          }),
      },
      rewardLedgerEntry: {
        create: async () => {
          state.ledger += 1;
        },
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(RewardsService);
    const at = new Date('2026-09-24T12:00:00.000Z');

    await Promise.all([
      service.recordEvent(
        'user-1',
        'FORUM_COMMENT_CREATED',
        { referenceType: 'ForumReply', referenceId: 'reply-1' },
        at,
      ),
      service.recordEvent(
        'user-1',
        'FORUM_COMMENT_CREATED',
        { referenceType: 'ForumReply', referenceId: 'reply-2' },
        at,
      ),
    ]);

    expect(state.progress).toBe(2);
    expect(state.completed).toBe(true);
    expect(state.points).toBe(25);
    expect(state.ledger).toBe(1);
  });

  it('ignores a repeated event without aborting the transaction', async () => {
    const state = {
      progress: 0,
      completed: false,
      points: 0,
      ledger: 0,
      receipts: new Set<string>(),
      created: false,
      aborted: false,
    };
    const prisma = {
      $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        if (state.aborted) {
          throw new Error('current transaction is aborted');
        }
        return fn(prisma);
      },
      rewardMission: {
        findMany: async () => [
          {
            id: 'mission-1',
            title: 'Poste no Fórum',
            description: 'Crie um tópico',
            category: 'COMMUNITY',
            period: 'DAILY',
            target: 1,
            pointsReward: 20,
            imageKey: 'missionForum',
            eventType: 'FORUM_TOPIC_CREATED',
            active: true,
          },
        ],
      },
      rewardEventReceipt: {
        createMany: async ({
          data,
        }: {
          data: Array<{ referenceId: string }>;
        }) => {
          const referenceId = data[0].referenceId;
          if (state.receipts.has(referenceId)) return { count: 0 };
          state.receipts.add(referenceId);
          return { count: 1 };
        },
      },
      rewardWallet: {
        findUnique: async () => ({
          id: 'wallet-1',
          userId: 'user-1',
          points: state.points,
          gold: 0,
          diamond: 0,
          updatedAt: new Date(),
        }),
        update: async ({
          data,
        }: {
          data: { points: { increment: number } };
        }) => {
          state.points += data.points.increment;
          return { id: 'wallet-1', points: state.points, gold: 0, diamond: 0 };
        },
      },
      userMissionProgress: {
        findUnique: async () =>
          state.created
            ? {
                id: 'progress-1',
                progress: state.progress,
                completed: state.completed,
                completedAt: null,
              }
            : null,
        createMany: async () => {
          if (state.created) return { count: 0 };
          state.created = true;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => ({
          id: 'progress-1',
          progress: state.progress,
          completed: state.completed,
          completedAt: state.completed ? new Date() : null,
        }),
        updateMany: async (args: {
          where: { completed?: boolean };
          data: { progress?: { increment: number }; completed?: boolean };
        }) => {
          if (args.where.completed === false && state.completed)
            return { count: 0 };
          if (args.data.progress?.increment) state.progress += 1;
          if (args.data.completed) state.completed = true;
          return { count: 1 };
        },
      },
      rewardLedgerEntry: {
        create: async () => {
          state.ledger += 1;
        },
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(RewardsService);
    const at = new Date('2026-09-24T12:00:00.000Z');
    const event = {
      referenceType: 'ForumThread',
      referenceId: 'thread-1',
    };

    await Promise.all([
      service.recordEvent('user-1', 'FORUM_TOPIC_CREATED', event, at),
      service.recordEvent('user-1', 'FORUM_TOPIC_CREATED', event, at),
    ]);

    expect(state.aborted).toBe(false);
    expect(state.progress).toBe(1);
    expect(state.points).toBe(20);
    expect(state.ledger).toBe(1);
  });

  it('propagates insert errors that are not duplicate keys', async () => {
    const prisma = {
      $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      rewardMission: {
        findMany: async () => [
          {
            id: 'mission-1',
            title: 'Poste no Fórum',
            description: 'Crie um tópico',
            category: 'COMMUNITY',
            period: 'DAILY',
            target: 1,
            pointsReward: 20,
            imageKey: 'missionForum',
            eventType: 'FORUM_TOPIC_CREATED',
            active: true,
          },
        ],
      },
      rewardEventReceipt: {
        createMany: async () => {
          throw new Error('database unavailable');
        },
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(RewardsService);

    await expect(
      service.recordEvent('user-1', 'FORUM_TOPIC_CREATED', {
        referenceType: 'ForumThread',
        referenceId: 'thread-err',
      }),
    ).rejects.toThrow('database unavailable');
  });

  it('does not spend the same gold twice', async () => {
    const state = { gold: 5, redemptions: 0 };
    const walletLock = createLock();
    const prisma = {
      $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      rewardCatalogItem: {
        findUnique: async () => ({
          id: 'item-1',
          name: 'Coins',
          imageKey: 'tc',
          active: true,
          price: 5,
          currency: 'GOLD',
        }),
      },
      rewardWallet: {
        findUnique: async () => ({
          id: 'wallet-1',
          userId: 'user-1',
          points: 0,
          gold: state.gold,
          diamond: 0,
          updatedAt: new Date(),
        }),
        findUniqueOrThrow: async () => ({
          points: 0,
          gold: state.gold,
          diamond: 0,
        }),
        updateMany: (args: {
          where: { gold?: { gte: number } };
          data: { gold?: { decrement: number } };
        }) =>
          walletLock(async () => {
            if ((args.where.gold?.gte ?? 0) > state.gold) return { count: 0 };
            state.gold -= args.data.gold?.decrement ?? 0;
            return { count: 1 };
          }),
      },
      rewardRedemption: {
        create: async () => {
          state.redemptions += 1;
          return {
            id: `redemption-${state.redemptions}`,
            status: 'PENDING',
            currency: 'GOLD',
            amount: 5,
            quantity: 1,
            createdAt: new Date(),
            catalogItem: { name: 'Coins', imageKey: 'tc' },
          };
        },
      },
      rewardRedemptionStatusEvent: { create: async () => ({}) },
      rewardLedgerEntry: { create: async () => ({}) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = moduleRef.get(RewardsService);
    const results = await Promise.allSettled([
      service.redeem('user-1', { catalogItemId: 'item-1' }),
      service.redeem('user-1', { catalogItemId: 'item-1' }),
    ]);

    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    const rejected = results.find((item) => item.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      BadRequestException,
    );
    expect(state.gold).toBe(0);
    expect(state.redemptions).toBe(1);
  });

  it('creates one account when two registrations use the same email', async () => {
    const users: Array<{ id: string; email: string }> = [];
    const emailLock = createLock();
    const prisma = {
      user: {
        findUnique: async () => null,
        create: (args: { data: { email: string } }) =>
          emailLock(async () => {
            if (users.some((user) => user.email === args.data.email)) {
              throw uniqueError();
            }
            const user = {
              id: `user-${users.length + 1}`,
              email: args.data.email,
              role: 'USER',
            };
            users.push(user);
            return user;
          }),
      },
      authSession: {
        deleteMany: async () => ({ count: 0 }),
        create: async () => ({
          id: 'session-1',
          expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: async () => 'token' },
        },
      ],
    }).compile();
    const service = moduleRef.get(AuthService);
    const results = await Promise.allSettled([
      service.register({ email: 'same@email.com', password: 'password1' }),
      service.register({ email: 'same@email.com', password: 'password1' }),
    ]);

    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = results.find((item) => item.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      ConflictException,
    );
    expect(users).toHaveLength(1);
  });

  describe('bestiary progress races', () => {
    function bestiaryPrisma(state: {
      kills: number;
      completed: boolean;
      rows: number;
      rewards: number;
      aborted: boolean;
    }) {
      const rowLock = createLock();
      const prisma = {
        $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => {
          try {
            return await fn(prisma);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes('current transaction is aborted')
            ) {
              state.aborted = true;
            }
            throw error;
          }
        },
        bestiaryEntry: {
          findFirst: async () => ({
            creatureId: 'creature-1',
            killsRequired: 1000,
          }),
        },
        rewardLedgerEntry: {
          create: async () => {
            state.rewards += 1;
          },
        },
        rewardWallet: {
          update: async () => {
            state.rewards += 1;
          },
        },
        userBestiaryProgress: {
          findUnique: async () =>
            state.rows === 0
              ? null
              : {
                  kills: state.kills,
                  completed: state.completed,
                  completedAt: null,
                },
          findUniqueOrThrow: async () => ({
            kills: state.kills,
            completed: state.completed,
            completedAt: null,
          }),
          create: async () => {
            state.aborted = true;
            throw new Error('current transaction is aborted');
          },
          createMany: (args: {
            data: Array<{ kills: number; completed: boolean }>;
          }) =>
            rowLock(async () => {
              if (state.rows > 0) return { count: 0 };
              state.rows = 1;
              state.kills = args.data[0].kills;
              state.completed = args.data[0].completed;
              return { count: 1 };
            }),
          updateMany: (args: {
            where: { kills: { lte: number } };
            data: { kills: number; completed: boolean };
          }) =>
            rowLock(async () => {
              if (state.kills > args.where.kills.lte) return { count: 0 };
              state.kills = args.data.kills;
              state.completed = args.data.completed;
              return { count: 1 };
            }),
        },
      };
      return prisma;
    }

    async function serviceFor(state: {
      kills: number;
      completed: boolean;
      rows: number;
      rewards: number;
      aborted: boolean;
    }) {
      const moduleRef = await Test.createTestingModule({
        providers: [
          BestiaryService,
          { provide: PrismaService, useValue: bestiaryPrisma(state) },
        ],
      }).compile();
      return moduleRef.get(BestiaryService);
    }

    it('creates one row when two first updates arrive together', async () => {
      const state = {
        kills: 0,
        completed: false,
        rows: 0,
        rewards: 0,
        aborted: false,
      };
      const service = await serviceFor(state);
      const results = await Promise.allSettled([
        service.updateProgress('user-1', 'cyclops', { kills: 15 }),
        service.updateProgress('user-1', 'cyclops', { kills: 15 }),
      ]);

      expect(results.every((item) => item.status === 'fulfilled')).toBe(true);
      expect(state.rows).toBe(1);
      expect(state.kills).toBe(15);
      expect(state.aborted).toBe(false);
      expect(state.rewards).toBe(0);
    });

    it('keeps the higher kill total when two first updates differ', async () => {
      const state = {
        kills: 0,
        completed: false,
        rows: 0,
        rewards: 0,
        aborted: false,
      };
      const service = await serviceFor(state);
      const results = await Promise.allSettled([
        service.updateProgress('user-1', 'cyclops', { kills: 10 }),
        service.updateProgress('user-1', 'cyclops', { kills: 20 }),
      ]);

      expect(results.some((item) => item.status === 'fulfilled')).toBe(true);
      expect(
        results.every(
          (item) =>
            item.status === 'rejected' &&
            String(item.reason).includes('aborted'),
        ),
      ).toBe(false);
      expect(state.kills).toBe(20);
      expect(state.rows).toBe(1);
      expect(state.aborted).toBe(false);
      expect(state.rewards).toBe(0);
    });

    it('keeps the higher total when progress already exists', async () => {
      const state = {
        kills: 50,
        completed: false,
        rows: 1,
        rewards: 0,
        aborted: false,
      };
      const service = await serviceFor(state);
      await Promise.allSettled([
        service.updateProgress('user-1', 'cyclops', { kills: 60 }),
        service.updateProgress('user-1', 'cyclops', { kills: 80 }),
      ]);

      expect(state.kills).toBe(80);
      expect(state.rows).toBe(1);
      expect(state.aborted).toBe(false);
      expect(state.rewards).toBe(0);
    });

    it('rejects simultaneous attempts to reduce kills', async () => {
      const state = {
        kills: 50,
        completed: false,
        rows: 1,
        rewards: 0,
        aborted: false,
      };
      const service = await serviceFor(state);
      const results = await Promise.allSettled([
        service.updateProgress('user-1', 'cyclops', { kills: 10 }),
        service.updateProgress('user-1', 'cyclops', { kills: 5 }),
      ]);

      expect(results.every((item) => item.status === 'rejected')).toBe(true);
      for (const item of results) {
        expect(item.status === 'rejected' && item.reason).toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(state.kills).toBe(50);
      expect(state.aborted).toBe(false);
    });

    it('does not grant a reward when two updates reach the completion mark', async () => {
      const state = {
        kills: 0,
        completed: false,
        rows: 0,
        rewards: 0,
        aborted: false,
      };
      const service = await serviceFor(state);
      const results = await Promise.all([
        service.updateProgress('user-1', 'cyclops', { kills: 1000 }),
        service.updateProgress('user-1', 'cyclops', { kills: 1000 }),
      ]);

      expect(results).toHaveLength(2);
      expect(state.kills).toBe(1000);
      expect(state.completed).toBe(true);
      expect(state.rows).toBe(1);
      expect(state.rewards).toBe(0);
      expect(state.aborted).toBe(false);
    });

    it('propagates bestiary insert errors that are not duplicate keys', async () => {
      const prisma = {
        $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) =>
          fn(prisma),
        bestiaryEntry: {
          findFirst: async () => ({
            creatureId: 'creature-1',
            killsRequired: 1000,
          }),
        },
        userBestiaryProgress: {
          findUnique: async () => null,
          createMany: async () => {
            throw new Error('database unavailable');
          },
        },
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          BestiaryService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const service = moduleRef.get(BestiaryService);

      await expect(
        service.updateProgress('user-1', 'cyclops', { kills: 10 }),
      ).rejects.toThrow('database unavailable');
    });
  });

  it('keeps both forum replies and both mission increments', async () => {
    const replies: Array<{ id: string; body: string }> = [];
    const state = {
      progress: 0,
      completed: false,
      points: 0,
      receipts: new Set<string>(),
    };
    const progressLock = createLock();
    const replyLock = createLock();
    let replySeq = 0;
    const now = new Date('2026-09-24T12:00:00.000Z');
    const thread = () => ({
      id: 'thread-1',
      title: 'Cave',
      body: 'Where?',
      status: 'OPEN' as const,
      createdAt: now,
      updatedAt: now,
      author: { id: 'user-1' },
      replies: replies.map((reply) => ({
        ...reply,
        createdAt: now,
        updatedAt: now,
        author: { id: 'user-1' },
      })),
      _count: { replies: replies.length },
    });
    const prisma = {
      $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
      forumThread: {
        findUnique: async () => thread(),
      },
      forumReply: {
        create: (args: { data: { body: string } }) =>
          replyLock(async () => {
            replySeq += 1;
            const reply = { id: `reply-${replySeq}`, body: args.data.body };
            replies.push(reply);
            return reply;
          }),
      },
      rewardMission: {
        findMany: async () => [
          {
            id: 'mission-1',
            title: 'Comentários',
            description: 'Faça 2 comentários',
            category: 'COMMUNITY',
            period: 'DAILY',
            target: 2,
            pointsReward: 25,
            imageKey: 'missionForum',
            eventType: 'FORUM_COMMENT_CREATED',
            active: true,
          },
        ],
      },
      rewardEventReceipt: {
        createMany: async ({
          data,
        }: {
          data: Array<{ referenceId: string }>;
        }) => {
          const referenceId = data[0].referenceId;
          if (state.receipts.has(referenceId)) return { count: 0 };
          state.receipts.add(referenceId);
          return { count: 1 };
        },
      },
      rewardWallet: {
        findUnique: async () => ({
          id: 'wallet-1',
          userId: 'user-1',
          points: state.points,
          gold: 0,
          diamond: 0,
          updatedAt: now,
        }),
        update: async ({
          data,
        }: {
          data: { points: { increment: number } };
        }) => {
          state.points += data.points.increment;
          return { id: 'wallet-1', points: state.points, gold: 0, diamond: 0 };
        },
      },
      userMissionProgress: {
        findUnique: async () => ({
          id: 'progress-1',
          progress: state.progress,
          completed: state.completed,
          completedAt: null,
        }),
        findUniqueOrThrow: async () => ({
          id: 'progress-1',
          progress: state.progress,
          completed: state.completed,
          completedAt: state.completed ? now : null,
        }),
        updateMany: (args: {
          where: { progress?: { lt: number }; completed?: boolean };
          data: { progress?: { increment: number }; completed?: boolean };
        }) =>
          progressLock(async () => {
            if (
              args.where.progress?.lt != null &&
              state.progress >= args.where.progress.lt
            ) {
              return { count: 0 };
            }
            if (args.where.completed === false && state.completed) {
              return { count: 0 };
            }
            if (args.data.progress?.increment) {
              state.progress += args.data.progress.increment;
            }
            if (args.data.completed) state.completed = true;
            return { count: 1 };
          }),
      },
      rewardLedgerEntry: { create: async () => ({}) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ForumService,
        RewardsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const forum = moduleRef.get(ForumService);

    const results = await Promise.all([
      forum.createReply('user-1', 'thread-1', { body: 'Thais' }),
      forum.createReply('user-1', 'thread-1', { body: 'Venore' }),
    ]);

    expect(replies.map((reply) => reply.body).sort()).toEqual([
      'Thais',
      'Venore',
    ]);
    expect(state.progress).toBe(2);
    expect(state.points).toBe(25);
    expect(results).toHaveLength(2);
  });

  it('rolls the reply back when the reward write fails', async () => {
    const replies: string[] = [];
    const prisma = {
      $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const snapshot = [...replies];
        try {
          return await fn(prisma);
        } catch (error) {
          replies.splice(0, replies.length, ...snapshot);
          throw error;
        }
      },
      forumThread: {
        findUnique: async () => ({
          id: 'thread-1',
          title: 'Cave',
          body: 'Where?',
          status: 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user-1' },
          replies: [],
          _count: { replies: replies.length },
        }),
      },
      forumReply: {
        create: async ({ data }: { data: { id?: string } }) => {
          replies.push('reply');
          return { id: 'reply-1', ...data };
        },
      },
    };
    const rewards = {
      recordEvent: async () => {
        throw new Error('reward failed');
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: PrismaService, useValue: prisma },
        { provide: RewardsService, useValue: rewards },
      ],
    }).compile();
    const service = moduleRef.get(ForumService);

    await expect(
      service.createReply('user-1', 'thread-1', { body: 'Thais' }),
    ).rejects.toThrow('reward failed');
    expect(replies).toHaveLength(0);
  });
});
