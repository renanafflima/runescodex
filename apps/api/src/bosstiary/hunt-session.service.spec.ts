import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HuntSessionStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { HuntSessionService } from './hunt-session.service';
import { PartyNotificationsService } from './party-notifications.service';
import { PartyService } from './party.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('HuntSessionService', () => {
  const prisma = {
    $transaction: jest.fn(),
    huntSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    huntSessionParticipant: { create: jest.fn(), findUnique: jest.fn() },
    communityRotation: { findUnique: jest.fn() },
    partyMember: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const parties = { requireActiveMember: jest.fn() };
  const notifications = { notify: jest.fn() };
  let service: HuntSessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    parties.requireActiveMember.mockResolvedValue({ role: 'LEADER', party: { name: 'Os Caçadores' } });
    const moduleRef = await Test.createTestingModule({
      providers: [
        HuntSessionService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartyService, useValue: parties },
        { provide: PartyNotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(HuntSessionService);
  });

  it('creates a session referencing an existing rotation', async () => {
    prisma.communityRotation.findUnique.mockResolvedValue({
      id: 'rot-1',
      title: 'Loop Oberon',
      status: 'PUBLISHED',
      userId: 'user-1',
    });
    prisma.partyMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.huntSession.create.mockResolvedValue({
      id: 'ses-1',
      partyId: 'party-1',
      createdById: 'user-1',
      title: 'Hunt de bosses',
      description: null,
      rotationId: 'rot-1',
      rotationTitle: 'Loop Oberon',
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      status: HuntSessionStatus.PLANNED,
      createdAt: new Date(),
      participants: [],
      rotation: { id: 'rot-1', title: 'Loop Oberon', status: 'PUBLISHED' },
    });
    const row = await service.create('user-1', 'party-1', {
      title: 'Hunt de bosses',
      rotationId: 'rot-1',
    });
    expect(row.rotationId).toBe('rot-1');
    expect(row.status).toBe(HuntSessionStatus.PLANNED);
  });

  it('starts and completes a session', async () => {
    const session = {
      id: 'ses-1',
      partyId: 'party-1',
      createdById: 'user-1',
      title: 'Hunt',
      description: null,
      rotationId: null,
      rotationTitle: null,
      plannedAt: null,
      startedAt: null,
      completedAt: null,
      status: HuntSessionStatus.PLANNED,
      createdAt: new Date(),
      participants: [],
      rotation: null,
    };
    prisma.huntSession.findFirst.mockResolvedValue(session);
    prisma.huntSession.update.mockResolvedValue({
      ...session,
      status: HuntSessionStatus.ACTIVE,
      startedAt: new Date(),
    });
    const started = await service.start('user-1', 'party-1', 'ses-1');
    expect(started.status).toBe(HuntSessionStatus.ACTIVE);
    prisma.huntSession.findFirst.mockResolvedValue({
      ...session,
      status: HuntSessionStatus.ACTIVE,
    });
    prisma.huntSession.update.mockResolvedValue({
      ...session,
      status: HuntSessionStatus.COMPLETED,
      completedAt: new Date(),
    });
    const done = await service.complete('user-1', 'party-1', 'ses-1');
    expect(done.status).toBe(HuntSessionStatus.COMPLETED);
  });

  it('rejects a second start', async () => {
    prisma.huntSession.findFirst.mockResolvedValue({
      id: 'ses-1',
      status: HuntSessionStatus.ACTIVE,
      participants: [],
      rotation: null,
      title: 'Hunt',
      partyId: 'party-1',
    });
    await expect(service.start('user-1', 'party-1', 'ses-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks a regular member from creating sessions', async () => {
    parties.requireActiveMember.mockResolvedValue({ role: 'MEMBER' });
    await expect(
      service.create('user-2', 'party-1', { title: 'Hunt' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels a planned session', async () => {
    prisma.huntSession.findFirst.mockResolvedValue({
      id: 'ses-1',
      partyId: 'party-1',
      title: 'Hunt',
      status: HuntSessionStatus.PLANNED,
      participants: [],
      rotation: null,
    });
    prisma.huntSession.update.mockResolvedValue({
      id: 'ses-1',
      partyId: 'party-1',
      createdById: 'user-1',
      title: 'Hunt',
      description: null,
      rotationId: null,
      rotationTitle: null,
      plannedAt: null,
      startedAt: null,
      completedAt: new Date(),
      status: HuntSessionStatus.CANCELLED,
      createdAt: new Date(),
      participants: [],
      rotation: null,
    });
    const row = await service.cancel('user-1', 'party-1', 'ses-1');
    expect(row.status).toBe(HuntSessionStatus.CANCELLED);
  });
});
