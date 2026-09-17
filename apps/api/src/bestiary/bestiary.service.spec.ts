import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  BestiaryService,
  estimatedHours,
  progressPercentage,
} from './bestiary.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const cyclopsEntry = {
  category: 'Thais',
  killsRequired: 1000,
  estimatedKillsPerHour: 260,
  charmPoints: null,
  creature: {
    id: 'c1',
    name: 'Cyclops',
    slug: 'cyclops',
    image: 'runescodex/creatures/Cyclops.gif',
    hp: 260,
    experience: null,
    difficulty: 'EASY',
    youtubeUrl: null,
    elements: [],
    locations: [{ name: 'Cyclops Cave', region: 'Thais' }],
    togetherFrom: [
      {
        relatedCreature: {
          id: 'c-smith',
          name: 'Cyclops Smith',
          slug: 'cyclops-smith',
          image: 'runescodex/creatures/Cyclops_Smith.gif',
        },
      },
    ],
    userProgress: [{ kills: 250, completed: false, completedAt: null }],
  },
};

describe('BestiaryService', () => {
  let service: BestiaryService;
  const prisma = {
    bestiaryEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    userBestiaryProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BestiaryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(BestiaryService);
  });

  it('lists bestiary entries in a single query without user progress', async () => {
    prisma.bestiaryEntry.findMany.mockResolvedValue([
      {
        ...cyclopsEntry,
        creature: { ...cyclopsEntry.creature, userProgress: undefined },
      },
    ]);

    const result = await service.findAll({});

    expect(prisma.bestiaryEntry.findMany).toHaveBeenCalledTimes(1);
    expect(result[0].progress).toBeNull();
    expect(result[0].together[0].slug).toBe('cyclops-smith');
    expect(result[0].estimatedHours).toBe(4);
  });

  it('returns the authenticated user progress without a per-row query', async () => {
    prisma.bestiaryEntry.findMany.mockResolvedValue([cyclopsEntry]);

    const result = await service.findAll({}, 'user-a');

    expect(prisma.bestiaryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { creature: { isActive: true } },
      }),
    );
    expect(result[0].progress).toEqual({
      kills: 250,
      completed: false,
      completedAt: null,
      progressPercentage: 25,
    });
  });

  it('throws when the creature has no bestiary entry', async () => {
    prisma.bestiaryEntry.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateProgress('user-a', 'missing', { kills: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userBestiaryProgress.upsert).not.toHaveBeenCalled();
  });

  it('upserts progress for the token user and marks completed from killsRequired', async () => {
    prisma.bestiaryEntry.findFirst.mockResolvedValue({
      creatureId: 'c1',
      killsRequired: 1000,
    });
    prisma.userBestiaryProgress.findUnique.mockResolvedValue(null);
    const completedAt = new Date('2026-09-17T00:00:00.000Z');
    prisma.userBestiaryProgress.upsert.mockResolvedValue({
      kills: 1000,
      completed: true,
      completedAt,
    });

    const result = await service.updateProgress('user-a', 'cyclops', {
      kills: 1000,
    });

    expect(prisma.userBestiaryProgress.upsert).toHaveBeenCalledTimes(1);
    const [[upsertArg]] = prisma.userBestiaryProgress.upsert.mock
      .calls as unknown as Array<
      [
        {
          where: { userId_creatureId: { userId: string; creatureId: string } };
          create: {
            userId: string;
            creatureId: string;
            kills: number;
            completed: boolean;
          };
          update: {
            kills: number;
            completed: boolean;
            completedAt: Date | null;
          };
        },
      ]
    >;
    expect(upsertArg.where).toEqual({
      userId_creatureId: { userId: 'user-a', creatureId: 'c1' },
    });
    expect(upsertArg.create).toMatchObject({
      userId: 'user-a',
      creatureId: 'c1',
      kills: 1000,
      completed: true,
    });
    expect(upsertArg.update).toMatchObject({
      kills: 1000,
      completed: true,
    });
    expect(result.completed).toBe(true);
    expect(result.progressPercentage).toBe(100);
  });

  it('clears completed when kills drop below the requirement', async () => {
    prisma.bestiaryEntry.findFirst.mockResolvedValue({
      creatureId: 'c1',
      killsRequired: 1000,
    });
    prisma.userBestiaryProgress.findUnique.mockResolvedValue({
      completedAt: new Date(),
    });
    prisma.userBestiaryProgress.upsert.mockResolvedValue({
      kills: 10,
      completed: false,
      completedAt: null,
    });

    await service.updateProgress('user-a', 'cyclops', { kills: 10 });

    expect(prisma.userBestiaryProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          kills: 10,
          completed: false,
          completedAt: null,
        },
      }),
    );
  });
});

describe('bestiary derived fields', () => {
  it('calculates estimated hours without persisting them', () => {
    expect(estimatedHours(500, 260)).toBe(2);
    expect(estimatedHours(1000, null)).toBeNull();
    expect(estimatedHours(1000, 0)).toBeNull();
  });

  it('calculates progress percentage at runtime', () => {
    expect(progressPercentage(250, 1000)).toBe(25);
    expect(progressPercentage(0, 1000)).toBe(0);
    expect(progressPercentage(1000, 1000)).toBe(100);
    expect(progressPercentage(50, 0)).toBe(0);
  });
});
