/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../../tickets/tickets.service';
import { AdminTicketsService } from './admin-tickets.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const ACTOR = '33333333-3333-4333-8333-333333333333';
const TICKET = '66666666-6666-4666-8666-666666666666';
const HUNT = '44444444-4444-4444-8444-444444444444';
const UPDATED = new Date('2026-10-20T12:00:00.000Z');

describe('AdminTicketsService', () => {
  let service: AdminTicketsService;
  const prisma = {
    $transaction: jest.fn(),
    ticket: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticketMessage: { create: jest.fn() },
    huntVocation: { updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const tickets = { updateStatus: jest.fn(), reopen: jest.fn() };
  const audit = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminTicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsService, useValue: tickets },
        { provide: AdminAuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(AdminTicketsService);
  });

  it('filters the queue by author and updated date without mixing the snapshot counts', async () => {
    prisma.ticket.count.mockResolvedValue(0);
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.groupBy
      .mockResolvedValueOnce([{ status: 'OPEN', _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ priority: 'URGENT', _count: { _all: 1 } }]);

    const result = await service.list(ACTOR, {
      author: 'Renan',
      dateField: 'updatedAt',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-20T00:00:00.000Z',
      page: 1,
      limit: 20,
    });

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          author: {
            activeCharacter: {
              name: { contains: 'Renan', mode: 'insensitive' },
            },
          },
          updatedAt: {
            gte: new Date('2026-10-01T00:00:00.000Z'),
            lt: new Date('2026-10-20T00:00:00.000Z'),
          },
        }) as unknown as Record<string, unknown>,
      }),
    );
    expect(result.summary.statuses.OPEN).toBe(2);
    expect(result.summary.priorities.URGENT).toBe(1);
    expect(result.summary.scope).toBe('snapshot');
  });

  it('rejects an urgent priority without a justification', async () => {
    await expect(
      service.priority(ACTOR, TICKET, {
        priority: 'URGENT',
        expectedUpdatedAt: UPDATED.toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('does not apply a correction twice', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET,
      updatedAt: UPDATED,
      contentAppliedAt: UPDATED,
      huntId: HUNT,
      status: 'IN_REVIEW',
      problemType: 'XP_PER_HOUR',
      userValue: '1000',
      vocations: [{ vocation: 'EK' }],
    });

    await expect(
      service.applyCorrection(ACTOR, TICKET, {
        expectedUpdatedAt: UPDATED.toISOString(),
      }),
    ).resolves.toEqual({ alreadyApplied: true, appliedAt: UPDATED });
    expect(prisma.huntVocation.updateMany).not.toHaveBeenCalled();
  });

  it('stores an internal note without treating it as the first public response', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET,
      updatedAt: UPDATED,
      firstResponseAt: null,
      status: 'OPEN',
    });
    prisma.ticketMessage.create.mockResolvedValue({
      id: 'message-1',
      visibility: 'INTERNAL',
      createdAt: UPDATED,
    });
    prisma.ticket.update.mockResolvedValue({});

    await service.addMessage(ACTOR, TICKET, {
      visibility: 'INTERNAL',
      body: 'Verificar o mapa antes de responder.',
      expectedUpdatedAt: UPDATED.toISOString(),
    });

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ticket.note' }),
      prisma,
    );
  });

  it('reports a conflict when the ticket changed', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET,
      updatedAt: new Date('2026-10-20T13:00:00.000Z'),
      firstResponseAt: null,
      status: 'OPEN',
    });

    await expect(
      service.addMessage(ACTOR, TICKET, {
        visibility: 'PUBLIC',
        body: 'Pode enviar um print atualizado?',
        expectedUpdatedAt: UPDATED.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticketMessage.create).not.toHaveBeenCalled();
  });
});
