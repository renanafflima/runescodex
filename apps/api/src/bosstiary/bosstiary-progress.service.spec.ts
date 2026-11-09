import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BosstiaryActivityKind,
  BosstiaryVisibility,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { BosstiaryProgressService } from './bosstiary-progress.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('BosstiaryProgressService', () => {
  const prisma = {
    $transaction: jest.fn(),
    bosstiaryProgressActivity: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    bosstiaryBoss: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    bosstiaryBossChecklist: {
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    communityRotation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    partyMember: {
      findUnique: jest.fn(),
    },
    huntSessionParticipant: {
      findUnique: jest.fn(),
    },
    creature: { findMany: jest.fn() },
  };

  let service: BosstiaryProgressService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    prisma.creature.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BosstiaryProgressService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(BosstiaryProgressService);
  });

  it('computes summary from real counts', async () => {
    prisma.bosstiaryProgressActivity.findMany.mockResolvedValue([
      { bossName: 'Oberon' },
      { bossName: 'Drume' },
    ]);
    prisma.bosstiaryProgressActivity.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(9);
    prisma.bosstiaryBoss.count.mockResolvedValue(12);
    prisma.bosstiaryBossChecklist.count.mockResolvedValue(3);
    await expect(service.summary('user-1')).resolves.toEqual({
      bossesDefeated: 2,
      dropsRegistered: 4,
      activitiesRegistered: 9,
      bossesTracked: 3,
      bossesCataloged: 12,
    });
  });

  it('rejects a drop without item', async () => {
    await expect(
      service.createActivity('user-1', {
        kind: BosstiaryActivityKind.DROP,
        bossName: 'Oberon',
        occurredAt: '2026-11-09T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts checklist when recording a cataloged kill', async () => {
    prisma.bosstiaryBoss.findFirst.mockResolvedValue({
      id: 'boss-1',
      name: 'Grand Master Oberon',
    });
    prisma.bosstiaryProgressActivity.create.mockResolvedValue({
      id: 'act-1',
      kind: BosstiaryActivityKind.BOSS_KILL,
      userId: 'user-1',
      bossId: 'boss-1',
      bossName: 'Grand Master Oberon',
      rotationId: null,
      rotationTitle: null,
      itemName: null,
      itemQuantity: null,
      note: null,
      visibility: BosstiaryVisibility.PRIVATE,
      occurredAt: new Date('2026-11-09T12:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      boss: {
        id: 'boss-1',
        slug: 'grand-master-oberon',
        name: 'Grand Master Oberon',
        officialCategory: 'Archfoe',
      },
      rotation: null,
    });
    prisma.bosstiaryBossChecklist.upsert.mockResolvedValue({
      defeated: true,
      lastDefeatedAt: new Date(),
    });
    const row = await service.createActivity('user-1', {
      kind: BosstiaryActivityKind.BOSS_KILL,
      bossId: 'boss-1',
      occurredAt: '2026-11-09T12:00:00.000Z',
      visibility: BosstiaryVisibility.PRIVATE,
    });
    expect(row.bossName).toBe('Grand Master Oberon');
    expect(prisma.bosstiaryBossChecklist.upsert).toHaveBeenCalled();
  });

  it('refuses another user rotation', async () => {
    prisma.communityRotation.findFirst.mockResolvedValue({
      id: 'rot-1',
      title: 'Loop',
      userId: 'other',
      status: 'PUBLISHED',
    });
    await expect(
      service.createActivity('user-1', {
        kind: BosstiaryActivityKind.BOSS_KILL,
        bossName: 'Oberon',
        rotationId: 'rot-1',
        occurredAt: '2026-11-09T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides another user activity as not found', async () => {
    prisma.bosstiaryProgressActivity.findUnique.mockResolvedValue({
      id: 'act-1',
      userId: 'other',
    });
    await expect(service.removeActivity('user-1', 'act-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('registers a drop linked to the origin boss', async () => {
    prisma.bosstiaryBoss.findFirst.mockResolvedValue({
      id: 'boss-1',
      name: 'Grand Master Oberon',
    });
    prisma.bosstiaryProgressActivity.create.mockResolvedValue({
      id: 'act-2',
      kind: BosstiaryActivityKind.DROP,
      userId: 'user-1',
      bossId: 'boss-1',
      bossName: 'Grand Master Oberon',
      rotationId: null,
      rotationTitle: null,
      itemName: 'Falcon Circlet',
      itemQuantity: 1,
      note: null,
      visibility: BosstiaryVisibility.PRIVATE,
      occurredAt: new Date('2026-11-09T12:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      boss: {
        id: 'boss-1',
        slug: 'grand-master-oberon',
        name: 'Grand Master Oberon',
        officialCategory: 'Archfoe',
      },
      rotation: null,
    });
    const row = await service.createActivity('user-1', {
      kind: BosstiaryActivityKind.DROP,
      bossId: 'boss-1',
      itemName: 'Falcon Circlet',
      itemQuantity: 1,
      occurredAt: '2026-11-09T12:00:00.000Z',
      visibility: BosstiaryVisibility.PRIVATE,
    });
    expect(row.itemName).toBe('Falcon Circlet');
    expect(row.visibility).toBe(BosstiaryVisibility.PRIVATE);
    expect(prisma.bosstiaryBossChecklist.upsert).not.toHaveBeenCalled();
  });

  it('hides private records from other party members', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      party: { status: 'ACTIVE' },
    });
    prisma.bosstiaryProgressActivity.count.mockResolvedValue(0);
    prisma.bosstiaryProgressActivity.findMany.mockResolvedValue([]);
    await service.listShared('user-1', 'party-1', {});
    expect(prisma.bosstiaryProgressActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          partyId: 'party-1',
          OR: [{ userId: 'user-1' }, { visibility: BosstiaryVisibility.GROUP }],
        }),
      }),
    );
  });

  it('refuses shared history after the user leaves the party', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'LEFT',
      party: { status: 'ACTIVE' },
    });
    await expect(service.listShared('user-2', 'party-1', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.bosstiaryProgressActivity.findMany).not.toHaveBeenCalled();
  });

  it('does not delete history when unchecking the checklist', async () => {
    prisma.bosstiaryBoss.findFirst.mockResolvedValue({
      id: 'boss-1',
      slug: 'oberon',
      name: 'Oberon',
      officialCategory: null,
    });
    prisma.bosstiaryBossChecklist.upsert.mockResolvedValue({
      defeated: false,
      lastDefeatedAt: new Date('2026-11-08T00:00:00.000Z'),
    });
    await service.updateChecklist('user-1', 'boss-1', false);
    expect(prisma.bosstiaryProgressActivity.delete).not.toHaveBeenCalled();
  });
});
