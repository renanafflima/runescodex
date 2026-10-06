import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ListHuntsQueryDto } from './dto/list-hunts-query.dto';
import { HuntsService } from './hunts.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('HuntsService', () => {
  let service: HuntsService;
  const prisma = {
    hunt: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    creature: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.hunt.count.mockResolvedValue(1);
    const moduleRef = await Test.createTestingModule({
      providers: [HuntsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(HuntsService);
  });

  it('lists active hunts in a single query and keeps XP/profit on vocations', async () => {
    prisma.hunt.findMany.mockResolvedValue([
      {
        id: 'hunt-1',
        name: 'Cyclops Hunt',
        slug: 'cyclops-hunt',
        location: 'Thais',
        subLocation: 'Cyclops Cave',
        difficulty: 'EASY',
        respawn: null,
        heroImage: null,
        mapImage: 'maps/cyclops.png',
        vocations: [
          {
            vocation: 'EK',
            isRecommended: true,
            levelMin: 40,
            levelMax: null,
            xpPerHour: 180000,
            profitPerHour: 30000,
            difficulty: null,
            notes: null,
          },
        ],
        creatures: [
          {
            isPrimary: true,
            recommendedCharm: null,
            creatureId: 'c1',
          },
        ],
      },
    ]);
    prisma.creature.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Cyclops',
        slug: 'cyclops',
        image: 'runescodex/creatures/Cyclops.gif',
      },
    ]);

    const result = await service.findAll({});

    expect(prisma.hunt.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.hunt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items[0].vocations[0].xpPerHour).toBe(180000);
    expect(result.items[0]).not.toHaveProperty('xpPerHour');
    expect(result.items[0].creatureCount).toBe(1);
    expect(result.items[0].creatures[0].slug).toBe('cyclops');
  });

  it('filters hunts by vocation and level on HuntVocation', async () => {
    prisma.hunt.findMany.mockResolvedValue([]);

    await service.findAll({ vocation: 'EK', level: 80 });

    expect(prisma.hunt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          vocations: {
            some: {
              vocation: 'EK',
              levelMin: { lte: 80 },
              OR: [{ levelMax: null }, { levelMax: { gte: 80 } }],
            },
          },
        },
      }),
    );
  });

  it('returns hunt detail with HuntCreature charm and creature elements', async () => {
    prisma.hunt.findFirst.mockResolvedValue({
      id: 'hunt-4',
      name: 'Demon Hunt',
      slug: 'demon-hunt',
      location: 'Edron',
      subLocation: 'Demon Pits',
      difficulty: 'VERY_HARD',
      respawn: null,
      description: null,
      heroImage: null,
      mapImage: 'maps/demon.png',
      vocations: [],
      creatures: [
        {
          id: 'hc-1',
          damageType: null,
          isPrimary: true,
          quantity: null,
          recommendedCharm: 'FREEZE',
          notes: null,
          creatureId: 'c4',
        },
      ],
      loot: [],
      videos: [
        {
          id: 'video-1',
          title: '<b>teste</b>',
          url: 'https://www.youtube.com/watch?v=abc',
          channel: 'Rune',
          isRecommended: true,
        },
        {
          id: 'video-2',
          title: 'blocked',
          url: 'javascript:alert(1)',
          channel: null,
          isRecommended: false,
        },
      ],
    });

    prisma.creature.findMany.mockResolvedValue([
      {
        id: 'c4',
        name: 'Demon',
        slug: 'demon',
        image: 'runescodex/creatures/Demon.gif',
        hp: 8200,
        experience: null,
        difficulty: 'VERY_HARD',
        youtubeUrl: 'javascript:alert(1)',
        elements: [{ element: 'HOLY', modifier: 150 }],
      },
    ]);

    const result = await service.findBySlug('demon-hunt');

    expect(result.creatures[0].recommendedCharm).toBe('FREEZE');
    expect(result.creatures[0].creature.elements).toEqual([
      { element: 'HOLY', modifier: 150 },
    ]);
    expect(result.loot).toEqual([]);
    expect(result.creatures[0].creature.youtubeUrl).toBeNull();
    expect(result.videos).toEqual([
      {
        id: 'video-1',
        title: '<b>teste</b>',
        url: 'https://www.youtube.com/watch?v=abc',
        channel: 'Rune',
        isRecommended: true,
      },
    ]);
  });

  it('keeps the hunt when a linked creature record is missing', async () => {
    prisma.hunt.findMany.mockResolvedValue([
      {
        id: 'hunt-2',
        name: 'Broken Link',
        slug: 'broken-link',
        location: 'Thais',
        subLocation: null,
        difficulty: 'EASY',
        respawn: null,
        heroImage: null,
        mapImage: null,
        vocations: [],
        creatures: [
          {
            isPrimary: true,
            recommendedCharm: null,
            creatureId: 'missing',
          },
          {
            isPrimary: false,
            recommendedCharm: null,
            creatureId: 'c1',
          },
        ],
      },
    ]);
    prisma.creature.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Cyclops',
        slug: 'cyclops',
        image: 'runescodex/creatures/Cyclops.gif',
      },
    ]);

    const result = await service.findAll({});

    expect(result.items[0].creatures).toEqual([
      {
        id: 'c1',
        name: 'Cyclops',
        slug: 'cyclops',
        image: 'runescodex/creatures/Cyclops.gif',
        isPrimary: false,
        recommendedCharm: null,
      },
    ]);
    expect(result.items[0].creatureCount).toBe(1);
  });

  it('throws when hunt slug does not exist', async () => {
    prisma.hunt.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns an empty page when no hunt matches', async () => {
    prisma.hunt.count.mockResolvedValue(0);
    prisma.hunt.findMany.mockResolvedValue([]);

    const result = await service.findAll({ difficulty: 'VERY_HARD' });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('filters by difficulty and text search', async () => {
    prisma.hunt.findMany.mockResolvedValue([]);

    await service.findAll({ difficulty: 'HARD', search: 'demon' });

    expect(prisma.hunt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          difficulty: 'HARD',
          AND: [
            {
              OR: [
                { name: { contains: 'demon', mode: 'insensitive' } },
                { location: { contains: 'demon', mode: 'insensitive' } },
                { subLocation: { contains: 'demon', mode: 'insensitive' } },
                {
                  creatures: {
                    some: {
                      creature: {
                        name: { contains: 'demon', mode: 'insensitive' },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('returns a hunt with several vocations and creatures', async () => {
    prisma.hunt.findMany.mockResolvedValue([
      {
        id: 'hunt-3',
        name: 'Mixed',
        slug: 'mixed',
        location: 'Edron',
        subLocation: null,
        difficulty: 'MEDIUM',
        respawn: null,
        heroImage: null,
        mapImage: null,
        vocations: [
          {
            vocation: 'EK',
            isRecommended: true,
            levelMin: 100,
            levelMax: null,
            xpPerHour: 1,
            profitPerHour: 1,
            difficulty: null,
            notes: null,
          },
          {
            vocation: 'RP',
            isRecommended: false,
            levelMin: 80,
            levelMax: 200,
            xpPerHour: 2,
            profitPerHour: 2,
            difficulty: 'HARD',
            notes: null,
          },
        ],
        creatures: [
          { isPrimary: true, recommendedCharm: 'FREEZE', creatureId: 'c1' },
          { isPrimary: false, recommendedCharm: null, creatureId: 'c2' },
        ],
      },
    ]);
    prisma.creature.findMany.mockResolvedValue([
      { id: 'c1', name: 'Demon', slug: 'demon', image: 'Demon.gif' },
      { id: 'c2', name: 'Dragon', slug: 'dragon', image: 'Dragon.gif' },
    ]);

    const result = await service.findAll({});

    expect(result.items[0].vocations.map((item) => item.vocation)).toEqual([
      'EK',
      'RP',
    ]);
    expect(result.items[0].creatures).toHaveLength(2);
    expect(result.items[0].creatureCount).toBe(2);
  });

  it('returns a hunt that has no vocation and no creatures', async () => {
    prisma.hunt.findFirst.mockResolvedValue({
      id: 'hunt-empty',
      name: 'Empty Hunt',
      slug: 'empty-hunt',
      location: 'Yalahar',
      subLocation: null,
      difficulty: 'EASY',
      respawn: null,
      description: null,
      heroImage: null,
      mapImage: null,
      vocations: [],
      creatures: [],
      loot: [],
      videos: [],
    });

    const result = await service.findBySlug('empty-hunt');

    expect(result.vocations).toEqual([]);
    expect(result.creatures).toEqual([]);
    expect(result.loot).toEqual([]);
    expect(prisma.creature.findMany).not.toHaveBeenCalled();
  });
});

describe('hunts query validation', () => {
  it('accepts vocation and difficulty and rejects invalid values', async () => {
    const valid = plainToInstance(ListHuntsQueryDto, {
      vocation: 'EM',
      difficulty: 'MEDIUM',
      search: 'yalahar',
      page: '1',
      limit: '20',
    });
    const invalidVocation = plainToInstance(ListHuntsQueryDto, {
      vocation: 'MONK',
    });
    const invalidDifficulty = plainToInstance(ListHuntsQueryDto, {
      difficulty: 'easy',
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(invalidVocation)).not.toHaveLength(0);
    expect(await validate(invalidDifficulty)).not.toHaveLength(0);
  });
});
