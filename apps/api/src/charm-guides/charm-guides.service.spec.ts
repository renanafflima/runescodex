import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CharmGuideCpCategory,
  CharmGuideDifficulty,
  CharmGuideStatus,
  TicketStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CharmGuidesService } from './charm-guides.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CharmGuidesService', () => {
  let service: CharmGuidesService;
  const prisma: any = {
    creature: { findMany: jest.fn() },
    hunt: { findMany: jest.fn() },
    charmGuide: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    charmGuideStep: { deleteMany: jest.fn() },
    charmGuideStep: { findMany: jest.fn() },
    charmGuideStepCreature: { findFirst: jest.fn(), findMany: jest.fn() },
    charmGuideLike: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    charmGuideFavorite: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    charmGuideCreatureProgress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    charmGuidePublishIdempotency: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    ticket: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    character: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharmGuidesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CharmGuidesService);
  });

  function detailRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'guide-1',
      userId: 'user-1',
      title: 'Guia 100 CP',
      description: 'Descrição completa do guia.',
      coverImage: null,
      cpCategory: CharmGuideCpCategory.CP_100,
      difficulty: CharmGuideDifficulty.EASY,
      status: CharmGuideStatus.DRAFT,
      totalCharmPoints: 40,
      uniqueCreatureCount: 2,
      stepCount: 2,
      adminResponse: null,
      publishedAt: null,
      createdAt: new Date('2026-11-10T12:00:00.000Z'),
      updatedAt: new Date('2026-11-10T12:00:00.000Z'),
      user: { id: 'user-1', activeCharacter: { name: 'Renan' } },
      _count: { likes: 0, favorites: 0, comments: 0, steps: 2 },
      ticket: null,
      steps: [
        {
          id: 'step-1',
          position: 1,
          title: null,
          notes: null,
          hunt: { id: 'hunt-1', slug: 'cyclops', name: 'Cyclops' },
          creatures: [
            {
              creatureId: 'c1',
              creature: {
                id: 'c1',
                slug: 'cyclops',
                name: 'Cyclops',
                image: 'a.gif',
                difficulty: 'EASY',
                bestiaryEntry: { charmPoints: 15 },
              },
            },
            {
              creatureId: 'c2',
              creature: {
                id: 'c2',
                slug: 'dragon',
                name: 'Dragon',
                image: 'b.gif',
                difficulty: 'MEDIUM',
                bestiaryEntry: { charmPoints: 25 },
              },
            },
          ],
        },
        {
          id: 'step-2',
          position: 2,
          title: null,
          notes: null,
          hunt: null,
          creatures: [
            {
              creatureId: 'c2',
              creature: {
                id: 'c2',
                slug: 'dragon',
                name: 'Dragon',
                image: 'b.gif',
                difficulty: 'MEDIUM',
                bestiaryEntry: { charmPoints: 25 },
              },
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('creates a draft and stores server-computed charm totals without trusting client points', async () => {
    prisma.creature.findMany.mockResolvedValue([
      { id: 'c1', bestiaryEntry: { charmPoints: 15 } },
      { id: 'c2', bestiaryEntry: { charmPoints: 25 } },
    ]);
    prisma.hunt.findMany.mockResolvedValue([{ id: 'hunt-1' }]);
    prisma.charmGuide.create.mockResolvedValue(
      detailRow({ totalCharmPoints: 40, uniqueCreatureCount: 2 }),
    );

    const result = await service.create('user-1', {
      title: 'Guia 100 CP',
      description: 'Descrição completa do guia.',
      cpCategory: CharmGuideCpCategory.CP_100,
      difficulty: CharmGuideDifficulty.EASY,
      steps: [
        { huntId: 'hunt-1', creatureIds: ['c1', 'c2'] },
        { creatureIds: ['c2'] },
      ],
    });

    expect(prisma.charmGuide.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalCharmPoints: 40,
          uniqueCreatureCount: 2,
          stepCount: 2,
        }),
      }),
    );
    expect(result.totalCharmPoints).toBe(40);
    expect(result.steps[1]?.creatures[0]?.repeatedFromEarlierStep).toBe(true);
  });

  it('rejects invalid creatures', async () => {
    prisma.creature.findMany.mockResolvedValue([
      { id: 'c1', bestiaryEntry: { charmPoints: 15 } },
    ]);
    await expect(
      service.create('user-1', {
        title: 'Guia 100 CP',
        description: 'Descrição completa do guia.',
        cpCategory: CharmGuideCpCategory.CP_100,
        difficulty: CharmGuideDifficulty.EASY,
        steps: [{ creatureIds: ['c1', 'missing'] }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submits for review and creates a ticket once', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.DRAFT }),
    );
    prisma.charmGuidePublishIdempotency.findUnique.mockResolvedValue(null);
    prisma.ticket.findFirst.mockResolvedValue(null);
    prisma.ticket.create.mockResolvedValue({
      id: 'ticket-1',
      protocol: 'RC-1',
      status: TicketStatus.OPEN,
    });
    prisma.charmGuide.update.mockResolvedValue(
      detailRow({
        status: CharmGuideStatus.PENDING_REVIEW,
        ticket: { id: 'ticket-1', protocol: 'RC-1', status: TicketStatus.OPEN },
      }),
    );

    const result = await service.submit('user-1', 'guide-1', 'key-1');

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          problemType: 'CHARM_GUIDE',
          charmGuideId: 'guide-1',
          origin: 'BESTIARY',
        }),
      }),
    );
    expect(result.status).toBe(CharmGuideStatus.PENDING_REVIEW);
  });

  it('blocks duplicate submit while the guide is already pending review', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PENDING_REVIEW }),
    );
    await expect(
      service.submit('user-1', 'guide-1', 'new-key'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.create).not.toHaveBeenCalled();
  });

  it('reopens the existing ticket when the guide is resubmitted', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.CHANGES_REQUESTED }),
    );
    prisma.charmGuidePublishIdempotency.findUnique.mockResolvedValue(null);
    prisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      status: TicketStatus.WAITING_ON_USER,
    });
    prisma.ticket.update.mockResolvedValue({
      id: 'ticket-1',
      protocol: 'RC-1',
      status: TicketStatus.OPEN,
    });
    prisma.charmGuide.update.mockResolvedValue(
      detailRow({
        status: CharmGuideStatus.PENDING_REVIEW,
        ticket: { id: 'ticket-1', protocol: 'RC-1', status: TicketStatus.OPEN },
      }),
    );

    await service.submit('user-1', 'guide-1', 'key-resubmit');

    expect(prisma.ticket.create).not.toHaveBeenCalled();
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          status: TicketStatus.OPEN,
          problemType: 'CHARM_GUIDE',
        }),
      }),
    );
  });

  it('prevents non-owners from editing', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ userId: 'other' }),
    );
    await expect(
      service.update('user-1', 'guide-1', { title: 'Novo título longo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks progress per character and does not invent charm points', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PUBLISHED }),
    );
    prisma.character.findFirst.mockResolvedValue({ id: 'char-1' });
    prisma.charmGuideStepCreature.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.charmGuideStep.findMany.mockResolvedValue([
      { guideId: 'guide-1' },
      { guideId: 'guide-2' },
    ]);
    prisma.charmGuideCreatureProgress.upsert.mockResolvedValue({});
    prisma.charmGuideCreatureProgress.findMany.mockResolvedValue([
      { creatureId: 'c1' },
    ]);
    prisma.charmGuideStepCreature.findMany.mockResolvedValue([
      {
        creatureId: 'c1',
        creature: { bestiaryEntry: { charmPoints: 15 } },
      },
      {
        creatureId: 'c2',
        creature: { bestiaryEntry: { charmPoints: 25 } },
      },
      {
        creatureId: 'c2',
        creature: { bestiaryEntry: { charmPoints: 25 } },
      },
    ]);

    const result = await service.updateProgress('user-1', 'guide-1', {
      characterId: 'char-1',
      creatureId: 'c1',
      completed: true,
    });

    expect(prisma.charmGuideCreatureProgress.upsert).toHaveBeenCalledTimes(2);
    expect(result.completedCharmPoints).toBe(15);
    expect(result.uniqueCreatureCount).toBe(2);
  });

  it('reuses creature completion across guides for the same character', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PUBLISHED }),
    );
    prisma.charmGuideLike.findMany.mockResolvedValue([]);
    prisma.charmGuideFavorite.findMany.mockResolvedValue([]);
    prisma.charmGuideStepCreature.findMany.mockResolvedValue([
      { creatureId: 'c1' },
      { creatureId: 'c2' },
    ]);
    prisma.charmGuideCreatureProgress.findMany.mockResolvedValue([
      { creatureId: 'c1', completedAt: new Date() },
    ]);

    const detail = await service.findOne('guide-1', 'user-1', 'char-1');
    const creatureStates = detail.steps.flatMap((step) => step.creatures);
    expect(creatureStates.find((row) => row.id === 'c1')?.completed).toBe(true);
    expect(creatureStates.find((row) => row.id === 'c2')?.completed).toBe(false);
  });

  it('publishes a pending guide as admin and resolves the ticket', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PENDING_REVIEW }),
    );
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.charmGuide.update.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PUBLISHED }),
    );
    prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1' });
    prisma.ticket.update.mockResolvedValue({});

    const result = await service.adminModerate(
      'admin-1',
      'guide-1',
      CharmGuideStatus.PUBLISHED,
      'Aprovado',
    );

    expect(result.status).toBe(CharmGuideStatus.PUBLISHED);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TicketStatus.RESOLVED }),
      }),
    );
  });

  it('hides unpublished guides from other users', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(
      detailRow({ status: CharmGuideStatus.PENDING_REVIEW, userId: 'owner' }),
    );
    await expect(service.findOne('guide-1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
