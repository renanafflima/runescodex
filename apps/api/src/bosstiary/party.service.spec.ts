import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PartyInvitationStatus,
  PartyMemberRole,
  PartyMemberStatus,
  PartyStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { PartyNotificationsService } from './party-notifications.service';
import { PartyService } from './party.service';
import { PARTY_LIMITS } from './party.constants';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PartyService', () => {
  const prisma = {
    $transaction: jest.fn(),
    party: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    partyMember: {
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    partyInvitation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const notifications = { notify: jest.fn() };
  let service: PartyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') return (fn as (tx: typeof prisma) => unknown)(prisma);
      return Promise.all(fn as Promise<unknown>[]);
    });
    prisma.partyInvitation.updateMany.mockResolvedValue({ count: 0 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        PartyService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartyNotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(PartyService);
  });

  it('creates a party with the caller as leader', async () => {
    prisma.partyMember.count.mockResolvedValue(0);
    prisma.party.create.mockResolvedValue({ id: 'party-1' });
    prisma.party.findUnique.mockResolvedValue({
      id: 'party-1',
      name: 'Os Caçadores',
      description: null,
      createdById: 'user-1',
      status: PartyStatus.ACTIVE,
      isPrivate: true,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'm1',
          userId: 'user-1',
          role: PartyMemberRole.LEADER,
          status: PartyMemberStatus.ACTIVE,
          joinedAt: new Date(),
          user: { id: 'user-1', email: 'a@a.com', activeCharacter: { name: 'Hero', vocation: 'EK', level: 400 } },
        },
      ],
    });
    const party = await service.create('user-1', { name: 'Os Caçadores' });
    expect(party.myRole).toBe(PartyMemberRole.LEADER);
    expect(prisma.party.create).toHaveBeenCalled();
  });

  it('invites an existing user and rejects a duplicate pending invite', async () => {
    prisma.partyMember.findUnique
      .mockResolvedValueOnce({
        role: PartyMemberRole.LEADER,
        status: PartyMemberStatus.ACTIVE,
        party: { name: 'Os Caçadores', status: PartyStatus.ACTIVE },
      })
      .mockResolvedValueOnce(null);
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'leader@rc.com' })
      .mockResolvedValueOnce({ id: 'user-2', email: 'friend@rc.com' });
    prisma.partyInvitation.findFirst.mockResolvedValue({ id: 'inv-1' });
    await expect(
      service.invite('user-1', 'party-1', { email: 'friend@rc.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores a pending invite for an email without an account', async () => {
    prisma.partyMember.findUnique
      .mockResolvedValueOnce({
        role: PartyMemberRole.LEADER,
        status: PartyMemberStatus.ACTIVE,
        party: { name: 'Os Caçadores', status: PartyStatus.ACTIVE },
      });
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'leader@rc.com' })
      .mockResolvedValueOnce(null);
    prisma.partyInvitation.findFirst.mockResolvedValue(null);
    prisma.partyInvitation.count.mockResolvedValue(0);
    prisma.partyMember.count.mockResolvedValue(1);
    prisma.partyInvitation.create.mockResolvedValue({
      id: 'inv-2',
      partyId: 'party-1',
      inviterId: 'user-1',
      emailNormalized: 'new@rc.com',
      inviteeUserId: null,
      status: PartyInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
      respondedAt: null,
      createdAt: new Date(),
    });
    const invite = await service.invite('user-1', 'party-1', { email: 'new@rc.com' });
    expect(invite.awaitingAccount).toBe(true);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects accepting an invite that belongs to another user', async () => {
    prisma.partyInvitation.findUnique.mockResolvedValue({
      id: 'inv-3',
      partyId: 'party-1',
      inviterId: 'user-1',
      emailNormalized: 'other@rc.com',
      inviteeUserId: 'user-9',
      status: PartyInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
    });
    await expect(service.accept('user-2', 'me@rc.com', 'inv-3')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an expired invite', async () => {
    prisma.partyInvitation.findUnique.mockResolvedValue({
      id: 'inv-4',
      partyId: 'party-1',
      inviterId: 'user-1',
      emailNormalized: 'me@rc.com',
      inviteeUserId: 'user-2',
      status: PartyInvitationStatus.EXPIRED,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.accept('user-2', 'me@rc.com', 'inv-4')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('keeps personal records when a member leaves', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      id: 'm2',
      role: PartyMemberRole.MEMBER,
      status: PartyMemberStatus.ACTIVE,
      party: { id: 'party-1', status: PartyStatus.ACTIVE },
    });
    prisma.partyMember.update.mockResolvedValue({});
    await expect(service.leave('user-2', 'party-1')).resolves.toEqual({
      id: 'party-1',
      left: true,
    });
    expect(prisma.partyMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PartyMemberStatus.LEFT }),
      }),
    );
  });

  it('exposes configurable member limits', () => {
    expect(PARTY_LIMITS.maxMembers).toBeGreaterThan(1);
    expect(PARTY_LIMITS.invitationExpiryDays).toBeGreaterThan(0);
  });

  it('blocks a regular member from inviting', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      role: PartyMemberRole.MEMBER,
      status: PartyMemberStatus.ACTIVE,
      party: { name: 'Os Caçadores', status: PartyStatus.ACTIVE },
    });
    await expect(
      service.invite('user-2', 'party-1', { email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a leader to transfer leadership before leaving', async () => {
    prisma.partyMember.findUnique.mockResolvedValue({
      id: 'm1',
      role: PartyMemberRole.LEADER,
      status: PartyMemberStatus.ACTIVE,
      party: { status: PartyStatus.ACTIVE },
    });
    await expect(service.leave('user-1', 'party-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts an invite for the authenticated email and upserts membership', async () => {
    prisma.partyInvitation.updateMany.mockResolvedValue({ count: 0 });
    prisma.partyInvitation.findUnique.mockResolvedValue({
      id: 'inv-5',
      partyId: 'party-1',
      inviterId: 'user-1',
      emailNormalized: 'me@rc.com',
      inviteeUserId: 'user-2',
      status: PartyInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
    });
    prisma.party.findUnique.mockResolvedValue({
      id: 'party-1',
      status: PartyStatus.ACTIVE,
    });
    prisma.partyMember.count.mockResolvedValue(0);
    prisma.partyInvitation.update.mockResolvedValue({});
    prisma.partyMember.upsert.mockResolvedValue({});
    prisma.party.findUniqueOrThrow.mockResolvedValue({
      name: 'Os Caçadores',
      createdById: 'user-1',
    });
    prisma.party.findUnique.mockResolvedValueOnce({
      id: 'party-1',
      status: PartyStatus.ACTIVE,
    }).mockResolvedValueOnce({
      id: 'party-1',
      name: 'Os Caçadores',
      description: null,
      createdById: 'user-1',
      status: PartyStatus.ACTIVE,
      isPrivate: true,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'm2',
          userId: 'user-2',
          role: PartyMemberRole.MEMBER,
          status: PartyMemberStatus.ACTIVE,
          joinedAt: new Date(),
          user: { id: 'user-2', email: 'me@rc.com', activeCharacter: null },
        },
      ],
    });
    const party = await service.accept('user-2', 'me@rc.com', 'inv-5');
    expect(prisma.partyMember.upsert).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'PARTY_INVITE_ACCEPTED' }),
    );
    expect(party.id).toBe('party-1');
  });

  it('declines an invite owned by the authenticated user', async () => {
    prisma.partyInvitation.findUnique.mockResolvedValue({
      id: 'inv-6',
      partyId: 'party-1',
      inviterId: 'user-1',
      emailNormalized: 'me@rc.com',
      inviteeUserId: 'user-2',
      status: PartyInvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 86400000),
    });
    prisma.party.findUnique.mockResolvedValue({
      id: 'party-1',
      name: 'Os Caçadores',
      status: PartyStatus.ACTIVE,
    });
    prisma.partyInvitation.update.mockResolvedValue({});
    const result = await service.decline('user-2', 'me@rc.com', 'inv-6');
    expect(result.status).toBe(PartyInvitationStatus.DECLINED);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'PARTY_INVITE_DECLINED' }),
    );
  });

  it('cancels pending invites when a member is removed', async () => {
    prisma.partyMember.findUnique
      .mockResolvedValueOnce({
        role: PartyMemberRole.LEADER,
        status: PartyMemberStatus.ACTIVE,
        party: { name: 'Os Caçadores', status: PartyStatus.ACTIVE },
      })
      .mockResolvedValueOnce({
        id: 'm2',
        role: PartyMemberRole.MEMBER,
        status: PartyMemberStatus.ACTIVE,
        user: { email: 'friend@rc.com' },
      });
    prisma.partyMember.update.mockResolvedValue({});
    prisma.partyInvitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.party.findUnique.mockResolvedValue({
      id: 'party-1',
      name: 'Os Caçadores',
      description: null,
      createdById: 'user-1',
      status: PartyStatus.ACTIVE,
      isPrivate: true,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'm1',
          userId: 'user-1',
          role: PartyMemberRole.LEADER,
          status: PartyMemberStatus.ACTIVE,
          joinedAt: new Date(),
          user: { id: 'user-1', email: 'leader@rc.com', activeCharacter: null },
        },
      ],
    });
    await service.removeMember('user-1', 'party-1', 'user-2');
    expect(prisma.partyInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PartyInvitationStatus.CANCELLED }),
      }),
    );
  });

  it('refuses party details after the user leaves', async () => {
    prisma.party.findUnique.mockResolvedValue({
      id: 'party-1',
      status: PartyStatus.ACTIVE,
      members: [],
    });
    await expect(service.get('user-2', 'party-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
