import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BosstiaryHuntMode,
  CommunityRotationStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { CommunityRotationsService } from './community-rotations.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function rotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rotation-1',
    userId: 'user-1',
    title: 'Quick bane loop',
    description: null,
    accessRequirements: null,
    additionalInfo: null,
    recommendedLevel: 'L500',
    huntMode: BosstiaryHuntMode.SOLO,
    plannedDurationMinutes: 30,
    vocation: null,
    characterLevel: null,
    partySize: null,
    observedTotalMinutes: null,
    combatMinutes: null,
    travelMinutes: null,
    status: CommunityRotationStatus.PUBLISHED,
    visibility: 'PUBLIC',
    partyId: null,
    party: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    user: {
      id: 'user-1',
      activeCharacter: { name: 'Rook Sample' },
    },
    bosses: [
      {
        id: 'stop-1',
        bossId: 'boss-1',
        bossName: null,
        position: 1,
        notes: null,
        boss: { id: 'boss-1', slug: 'the-welter', name: 'The Welter' },
      },
    ],
    _count: { likes: 0, favorites: 0, comments: 0 },
    ...overrides,
  };
}

describe('CommunityRotationsService', () => {
  let service: CommunityRotationsService;
  const rewards = {
    recordEvent: jest.fn().mockResolvedValue({ applied: [] }),
  };
  const prisma = {
    $transaction: jest.fn(),
    communityRotation: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    communityRotationPublishIdempotency: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
    communityRotationBoss: {
      deleteMany: jest.fn(),
    },
    communityRotationLike: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    communityRotationFavorite: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    communityRotationTest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    bosstiaryBoss: {
      findMany: jest.fn(),
    },
    creature: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    partyMember: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    prisma.communityRotationLike.groupBy.mockResolvedValue([]);
    prisma.communityRotation.findMany.mockResolvedValue([]);
    prisma.communityRotationLike.findMany.mockResolvedValue([]);
    prisma.communityRotationFavorite.findMany.mockResolvedValue([]);
    prisma.communityRotationTest.findMany.mockResolvedValue([]);
    prisma.communityRotationTest.findFirst.mockResolvedValue(null);
    prisma.creature.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    prisma.partyMember.findUnique.mockResolvedValue(null);
    prisma.communityRotation.count.mockResolvedValue(0);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommunityRotationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RewardsService, useValue: rewards },
      ],
    }).compile();

    service = moduleRef.get(CommunityRotationsService);
  });

  it('creates a rotation with bosses', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);
    prisma.communityRotation.create.mockResolvedValue(rotationRow());

    const result = await service.create('user-1', {
      title: 'Quick bane loop',
      recommendedLevel: 'L500',
      huntMode: BosstiaryHuntMode.SOLO,
      plannedDurationMinutes: 30,
      bosses: [{ bossId: 'boss-1', position: 1 }],
    });

    expect(prisma.communityRotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          bosses: {
            create: [
              {
                bossId: 'boss-1',
                bossName: null,
                position: 1,
                notes: null,
              },
            ],
          },
        }),
      }),
    );
    expect(result.author.name).toBe('Rook Sample');
    expect(result.bosses[0].slug).toBe('the-welter');
    expect(prisma.communityRotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: 'PUBLIC',
          partyId: null,
        }),
      }),
    );
  });

  it('shares a rotation with a party the author belongs to', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      party: { status: 'ACTIVE' },
    });
    prisma.communityRotation.create.mockResolvedValue(
      rotationRow({
        visibility: 'GROUP',
        partyId: 'party-1',
        party: { id: 'party-1', name: 'Os Caçadores' },
      }),
    );

    const result = await service.create('user-1', {
      title: 'Quick bane loop',
      recommendedLevel: 'L500',
      huntMode: BosstiaryHuntMode.SOLO,
      plannedDurationMinutes: 30,
      visibility: 'GROUP',
      partyId: 'party-1',
      bosses: [{ bossId: 'boss-1', position: 1 }],
    });

    expect(prisma.communityRotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: 'GROUP',
          partyId: 'party-1',
        }),
      }),
    );
    expect(result.partyId).toBe('party-1');
    expect(result.visibility).toBe('GROUP');
  });

  it('rejects sharing with a party the user does not belong to', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);
    prisma.partyMember.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        title: 'Quick bane loop',
        recommendedLevel: 'L500',
        huntMode: BosstiaryHuntMode.SOLO,
        plannedDurationMinutes: 30,
        visibility: 'GROUP',
        partyId: 'party-foreign',
        bosses: [{ bossId: 'boss-1', position: 1 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.communityRotation.create).not.toHaveBeenCalled();
  });

  it('keeps the public feed free of private and party rotations', async () => {
    prisma.communityRotation.count.mockResolvedValue(0);
    prisma.communityRotation.findMany.mockResolvedValue([]);

    await service.list({ page: 1, limit: 12 }, 'user-2');

    expect(prisma.communityRotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { visibility: 'PUBLIC' },
          ]),
        }),
      }),
    );
  });

  it('lists party rotations only for active members', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      party: { status: 'ACTIVE' },
    });
    prisma.communityRotation.count.mockResolvedValue(1);
    prisma.communityRotation.findMany.mockResolvedValue([
      rotationRow({
        visibility: 'GROUP',
        partyId: 'party-1',
        party: { id: 'party-1', name: 'Os Caçadores' },
      }),
    ]);

    const result = await service.listByParty('user-2', 'party-1', { page: 1, limit: 12 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].partyId).toBe('party-1');
  });

  it('hides party rotations from users who left the party', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      status: 'LEFT',
      party: { status: 'ACTIVE' },
    });

    await expect(
      service.listByParty('user-2', 'party-1', { page: 1, limit: 12 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides a private rotation from other users', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue(
      rotationRow({ visibility: 'PRIVATE', userId: 'user-1' }),
    );

    await expect(service.findOne('rotation-1', 'user-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('records reward event when publishing', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);
    prisma.communityRotation.create.mockResolvedValue(rotationRow());

    await service.create('user-1', {
      title: 'Quick bane loop',
      recommendedLevel: 'L500',
      huntMode: BosstiaryHuntMode.SOLO,
      plannedDurationMinutes: 30,
      bosses: [{ bossId: 'boss-1', position: 1 }],
    });

    expect(rewards.recordEvent).toHaveBeenCalledWith(
      'user-1',
      'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED',
      { referenceType: 'CommunityRotation', referenceId: 'rotation-1' },
      expect.any(Date),
      prisma,
    );
  });

  it('still publishes when Rewards has not allowlisted the event yet', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);
    prisma.communityRotation.create.mockResolvedValue(rotationRow());
    rewards.recordEvent.mockRejectedValue(
      new BadRequestException('Invalid reward event'),
    );

    const result = await service.create('user-1', {
      title: 'Quick bane loop',
      recommendedLevel: 'L500',
      huntMode: BosstiaryHuntMode.SOLO,
      plannedDurationMinutes: 30,
      bosses: [{ bossId: 'boss-1', position: 1 }],
    });

    expect(result.id).toBe('rotation-1');
  });

  it('rejects duplicate likes', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rotation-1',
      userId: 'user-1',
      status: CommunityRotationStatus.PUBLISHED,
      visibility: 'PUBLIC',
      partyId: null,
    });
    prisma.communityRotationLike.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.like('rotation-1', 'user-2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects edit from non-author users', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rotation-1',
      userId: 'user-1',
    });

    await expect(
      service.update('rotation-1', 'user-2', { title: 'Hijacked' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects empty boss lists', async () => {
    await expect(
      service.create('user-1', {
        title: 'Empty',
        recommendedLevel: 'L300',
        huntMode: BosstiaryHuntMode.SOLO,
        plannedDurationMinutes: 15,
        bosses: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.communityRotation.create).not.toHaveBeenCalled();
  });

  it('marks removed rotations without deleting engagement rows', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rotation-1',
      userId: 'user-1',
      status: CommunityRotationStatus.PUBLISHED,
    });
    prisma.communityRotation.update.mockResolvedValue({});

    const result = await service.remove('rotation-1', 'user-1');

    expect(prisma.communityRotation.update).toHaveBeenCalledWith({
      where: { id: 'rotation-1' },
      data: { status: CommunityRotationStatus.REMOVED },
    });
    expect(result).toEqual({ id: 'rotation-1', removed: true });
  });

  it('rejects duplicate boss ids in the same rotation', async () => {
    prisma.bosstiaryBoss.findMany.mockResolvedValue([{ id: 'boss-1' }]);

    await expect(
      service.create('user-1', {
        title: 'Dup',
        recommendedLevel: 'L300',
        huntMode: BosstiaryHuntMode.SOLO,
        plannedDurationMinutes: 30,
        bosses: [
          { bossId: 'boss-1', position: 1 },
          { bossId: 'boss-1', position: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.communityRotation.create).not.toHaveBeenCalled();
  });

  it('ranks rotations by weekly likes', async () => {
    prisma.communityRotationLike.groupBy.mockResolvedValue([
      { rotationId: 'rotation-2', _count: { _all: 5 } },
      { rotationId: 'rotation-1', _count: { _all: 3 } },
    ]);
    prisma.communityRotation.findMany.mockResolvedValue([
      rotationRow({ id: 'rotation-2', title: 'Top' }),
      rotationRow({ id: 'rotation-1' }),
    ]);

    const ranking = await service.weeklyRanking(2);

    expect(ranking).toHaveLength(2);
    expect(ranking[0].id).toBe('rotation-2');
    expect(ranking[0].weeklyLikes).toBe(5);
    expect(ranking[0].featured).toBe(true);
  });

  it('rejects a second evaluation from the same user', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rotation-1',
      userId: 'user-1',
      status: CommunityRotationStatus.PUBLISHED,
      visibility: 'PUBLIC',
      partyId: null,
    });
    prisma.communityRotationTest.findFirst.mockResolvedValue({ id: 'test-1' });

    await expect(service.createTest('rotation-1', 'user-2', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.communityRotationTest.create).not.toHaveBeenCalled();
  });
});
