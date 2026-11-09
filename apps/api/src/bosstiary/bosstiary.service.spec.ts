import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  Vocation,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { BosstiaryService } from './bosstiary.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('BosstiaryService', () => {
  let service: BosstiaryService;
  const prisma = {
    bosstiaryBoss: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    bosstiaryTravelEdge: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [BosstiaryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BosstiaryService);
  });

  it('exposes planner metadata without inventing boss data', () => {
    expect(service.meta().timeOptions.map((item) => item.minutes)).toEqual([15, 20, 30, 60]);
    expect(service.meta().vocations.map((item) => item.code)).toEqual(['EK', 'RP', 'MS', 'ED', 'EM']);
  });

  it('lists reviewed bosses and keeps pending facts explicit', async () => {
    prisma.bosstiaryBoss.count.mockResolvedValue(1);
    prisma.bosstiaryBoss.findMany.mockResolvedValue([
      {
        id: 'boss-1',
        slug: 'the-welter',
        name: 'The Welter',
        officialCategory: 'Bane',
        huntMode: BosstiaryHuntMode.SOLO,
        recommendedLevelSolo: 500,
        recommendedLevelParty: null,
        difficulty: 'MEDIUM',
        locationName: 'Venore',
        locationRegion: null,
        originCity: 'Venore',
        accessStatus: BosstiaryAccessStatus.UNKNOWN,
        accessRequirements: null,
        howToReach: null,
        cooldownSeconds: null,
        estimatedCombatMinutes: null,
        bossPoints: null,
        mechanics: null,
        strategy: null,
        vocations: [],
      },
    ]);
    const result = await service.findAll({ huntMode: BosstiaryHuntMode.SOLO });
    expect(result.items[0].facts.cooldownSeconds.kind).toBe('pending');
    expect(result.items[0].facts.accessStatus.kind).toBe('pending');
  });

  it('searches reviewed bosses by partial name', async () => {
    prisma.bosstiaryBoss.count.mockResolvedValue(1);
    prisma.bosstiaryBoss.findMany.mockResolvedValue([
      {
        id: 'boss-1',
        slug: 'grand-master-oberon',
        name: 'Grand Master Oberon',
        officialCategory: 'Archfoe',
        huntMode: BosstiaryHuntMode.SOLO,
        recommendedLevelSolo: 300,
        recommendedLevelParty: null,
        difficulty: null,
        locationName: null,
        locationRegion: null,
        originCity: null,
        accessStatus: BosstiaryAccessStatus.UNKNOWN,
        accessRequirements: null,
        howToReach: null,
        cooldownSeconds: null,
        estimatedCombatMinutes: null,
        bossPoints: null,
        mechanics: null,
        strategy: null,
        vocations: [],
      },
    ]);
    await service.findAll({ search: 'oberon' });
    expect(prisma.bosstiaryBoss.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: 'oberon', mode: 'insensitive' } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('throws when a reviewed profile does not exist', async () => {
    prisma.bosstiaryBoss.findFirst.mockResolvedValue(null);
    await expect(service.findBySlug('ferumbras')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty rotation set when the database has no reviewed bosses', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([]);
    prisma.bosstiaryTravelEdge.findMany.mockResolvedValue([]);
    const result = await service.findRotations({
      availableMinutes: 15,
      level: 500,
      huntMode: BosstiaryHuntMode.SOLO,
      vocation: Vocation.EK,
      originCity: 'Thais',
    });
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toMatch(/não há bosses revisados/i);
  });
});
