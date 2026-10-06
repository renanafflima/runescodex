import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ListBestiaryQueryDto } from './dto/list-bestiary-query.dto';
import {
  BestiaryService,
  estimatedHours,
  progressPercentage,
} from './bestiary.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const cyclops = {
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
  bestiaryEntry: {
    category: 'Thais',
    killsRequired: 1000,
    estimatedKillsPerHour: 260,
    charmPoints: null,
  },
  userProgress: [{ kills: 250, completed: false, completedAt: null }],
};

describe('BestiaryService', () => {
  let service: BestiaryService;
  const prisma = {
    $transaction: jest.fn(),
    creature: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    bestiaryEntry: {
      findFirst: jest.fn(),
    },
    userBestiaryProgress: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.creature.count.mockResolvedValue(1);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BestiaryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(BestiaryService);
  });

  it('lists creatures in a single query without user progress', async () => {
    prisma.creature.findMany.mockResolvedValue([
      { ...cyclops, userProgress: undefined },
    ]);

    const result = await service.findAll({});

    expect(prisma.creature.findMany).toHaveBeenCalledTimes(1);
    expect(result.items[0].progress).toBeNull();
    expect(result.items[0].together[0].slug).toBe('cyclops-smith');
    expect(result.items[0].estimatedHours).toBe(4);
    expect(prisma.creature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('returns an empty page when no creature matches', async () => {
    prisma.creature.count.mockResolvedValue(0);
    prisma.creature.findMany.mockResolvedValue([]);

    const result = await service.findAll({ difficulty: 'HARD' });

    expect(result).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    });
    expect(prisma.creature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, difficulty: 'HARD' },
      }),
    );
  });

  it('keeps a creature that has no bestiary entry', async () => {
    prisma.creature.findMany.mockResolvedValue([
      { ...cyclops, bestiaryEntry: null, userProgress: undefined },
    ]);

    const result = await service.findAll({});

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        slug: 'cyclops',
        killsRequired: null,
        estimatedHours: null,
        progress: null,
      }),
    );
  });

  it('filters by difficulty and search on the creature catalog', async () => {
    prisma.creature.findMany.mockResolvedValue([]);

    await service.findAll({ difficulty: 'EASY', search: '  cave ' });

    expect(prisma.creature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          difficulty: 'EASY',
          OR: [
            { name: { contains: 'cave', mode: 'insensitive' } },
            {
              locations: {
                some: {
                  OR: [
                    { name: { contains: 'cave', mode: 'insensitive' } },
                    { region: { contains: 'cave', mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              togetherFrom: {
                some: {
                  relatedCreature: {
                    name: { contains: 'cave', mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        },
      }),
    );
  });

  it('returns the authenticated user progress without a per-row query', async () => {
    prisma.creature.findMany.mockResolvedValue([cyclops]);

    const result = await service.findAll({}, 'user-a');

    expect(prisma.creature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
    expect(result.items[0].progress).toEqual({
      kills: 250,
      completed: false,
      completedAt: null,
      progressPercentage: 25,
    });
  });

  it('returns a creature even when the bestiary entry is missing', async () => {
    prisma.creature.findFirst.mockResolvedValue({
      ...cyclops,
      description: 'A one-eyed giant.',
      bestiaryEntry: null,
      userProgress: undefined,
    });

    const result = await service.findBySlug('cyclops');

    expect(result.slug).toBe('cyclops');
    expect(result.description).toBe('A one-eyed giant.');
    expect(result.killsRequired).toBeNull();
  });

  it('throws when the creature does not exist', async () => {
    prisma.creature.findFirst.mockResolvedValue(null);
    prisma.bestiaryEntry.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateProgress('user-a', 'missing', { kills: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userBestiaryProgress.createMany).not.toHaveBeenCalled();
    expect(prisma.userBestiaryProgress.updateMany).not.toHaveBeenCalled();
  });

  it('stores a higher kill total and marks the entry completed', async () => {
    prisma.bestiaryEntry.findFirst.mockResolvedValue({
      creatureId: 'c1',
      killsRequired: 1000,
    });
    prisma.userBestiaryProgress.findUnique.mockResolvedValue(null);
    const completedAt = new Date('2026-09-17T00:00:00.000Z');
    prisma.userBestiaryProgress.createMany.mockResolvedValue({ count: 1 });
    prisma.userBestiaryProgress.updateMany.mockResolvedValue({ count: 1 });
    prisma.userBestiaryProgress.findUniqueOrThrow.mockResolvedValue({
      kills: 1000,
      completed: true,
      completedAt,
    });

    const result = await service.updateProgress('user-a', 'cyclops', {
      kills: 1000,
    });

    expect(prisma.userBestiaryProgress.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'user-a',
          creatureId: 'c1',
          kills: 1000,
          completed: true,
        }),
      ],
      skipDuplicates: true,
    });
    expect(prisma.userBestiaryProgress.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-a',
          creatureId: 'c1',
          kills: { lte: 1000 },
        },
      }),
    );
    expect(result.completed).toBe(true);
    expect(result.progressPercentage).toBe(100);
  });

  it('rejects a kill total below the stored progress', async () => {
    prisma.bestiaryEntry.findFirst.mockResolvedValue({
      creatureId: 'c1',
      killsRequired: 1000,
    });
    prisma.userBestiaryProgress.findUnique.mockResolvedValue({
      kills: 100,
      completedAt: new Date(),
    });

    await expect(
      service.updateProgress('user-a', 'cyclops', { kills: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userBestiaryProgress.updateMany).not.toHaveBeenCalled();
  });
});

describe('bestiary query validation', () => {
  it('accepts a valid difficulty and rejects an invalid one', async () => {
    const valid = plainToInstance(ListBestiaryQueryDto, {
      difficulty: 'VERY_HARD',
      page: '2',
      limit: '20',
      search: 'demon',
    });
    const invalid = plainToInstance(ListBestiaryQueryDto, {
      difficulty: 'easy',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(valid.page).toBe(2);
    expect(await validate(invalid)).not.toHaveLength(0);
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
