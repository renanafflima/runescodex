import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HuntsService } from './hunts.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('HuntsService', () => {
  let service: HuntsService;
  const prisma = {
    hunt: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
            creature: {
              id: 'c1',
              name: 'Cyclops',
              slug: 'cyclops',
              image: 'runescodex/creatures/Cyclops.gif',
            },
          },
        ],
      },
    ]);

    const result = await service.findAll({});

    expect(prisma.hunt.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.hunt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    );
    expect(result[0].vocations[0].xpPerHour).toBe(180000);
    expect(result[0]).not.toHaveProperty('xpPerHour');
    expect(result[0].creatureCount).toBe(1);
    expect(result[0].creatures[0].slug).toBe('cyclops');
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
          creature: {
            id: 'c4',
            name: 'Demon',
            slug: 'demon',
            image: 'runescodex/creatures/Demon.gif',
            hp: 8200,
            experience: null,
            difficulty: 'VERY_HARD',
            youtubeUrl: null,
            elements: [{ element: 'HOLY', modifier: 150 }],
          },
        },
      ],
      loot: [],
      videos: [],
    });

    const result = await service.findBySlug('demon-hunt');

    expect(result.creatures[0].recommendedCharm).toBe('FREEZE');
    expect(result.creatures[0].creature.elements).toEqual([
      { element: 'HOLY', modifier: 150 },
    ]);
    expect(result.loot).toEqual([]);
    expect(result.videos).toEqual([]);
  });

  it('throws when hunt slug does not exist', async () => {
    prisma.hunt.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
