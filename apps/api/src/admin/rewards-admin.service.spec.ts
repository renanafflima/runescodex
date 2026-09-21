import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { RewardsAdminService } from './rewards-admin.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-a';
const REDEMPTION_ID = '44444444-4444-4444-8444-444444444444';
const WALLET_ID = 'wallet-a';

function redemptionRow(overrides = {}) {
  return {
    id: REDEMPTION_ID,
    userId: USER_ID,
    walletId: WALLET_ID,
    catalogItemId: '22222222-2222-4222-8222-222222222222',
    currency: 'GOLD',
    amount: 5,
    quantity: 1,
    status: 'PENDING',
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
    approvedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    refundedAt: null,
    approvedByUserId: null,
    deliveredByUserId: null,
    cancelledByUserId: null,
    adminNote: null,
    cancellationReason: null,
    deliveryNote: null,
    user: { id: USER_ID, email: 'user@email.com' },
    catalogItem: {
      id: '22222222-2222-4222-8222-222222222222',
      name: '125 Tibia Coins',
      imageKey: 'tc125',
    },
    approvedBy: null,
    deliveredBy: null,
    cancelledBy: null,
    statusEvents: [],
    ...overrides,
  };
}

describe('AdminGuard', () => {
  let guard: AdminGuard;
  const prisma = {
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AdminGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = moduleRef.get(AdminGuard);
  });

  function ctx(user?: { userId: string }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  it('rejects unauthenticated calls', async () => {
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a regular user from admin endpoints', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    await expect(
      guard.canActivate(ctx({ userId: USER_ID })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows only ADMIN role', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    await expect(guard.canActivate(ctx({ userId: ADMIN_ID }))).resolves.toBe(
      true,
    );
  });
});

describe('RewardsAdminService', () => {
  let service: RewardsAdminService;
  const prisma = {
    $transaction: jest.fn(),
    rewardRedemption: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    rewardRedemptionStatusEvent: {
      create: jest.fn(),
    },
    rewardWallet: {
      update: jest.fn(),
    },
    rewardLedgerEntry: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    const moduleRef = await Test.createTestingModule({
      providers: [
        RewardsAdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(RewardsAdminService);
  });

  it('lists redemptions with status counts', async () => {
    prisma.rewardRedemption.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
    ]);
    prisma.rewardRedemption.findMany.mockResolvedValue([redemptionRow()]);

    const result = await service.list({});
    expect(result.counts.PENDING).toBe(2);
    expect(result.items[0].status).toBe('PENDING');
    expect(result.items[0].price).toBe(5);
  });

  it('approves a pending redemption without debiting again', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardRedemption.findUniqueOrThrow.mockResolvedValue(
      redemptionRow({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: ADMIN_ID,
        approvedBy: { id: ADMIN_ID, email: 'admin@email.com' },
      }),
    );

    const result = await service.approve(ADMIN_ID, REDEMPTION_ID, {});
    expect(result.status).toBe('APPROVED');
    expect(prisma.rewardWallet.update).not.toHaveBeenCalled();
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('delivers an approved redemption without creating a new debit', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'APPROVED' }),
    );
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardRedemption.findUniqueOrThrow.mockResolvedValue(
      redemptionRow({ status: 'DELIVERED', deliveredAt: new Date() }),
    );

    const result = await service.deliver(ADMIN_ID, REDEMPTION_ID, {
      deliveryNote: 'enviado',
    });
    expect(result.status).toBe('DELIVERED');
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('cancels a pending redemption and refunds once', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.update.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardRedemption.findUniqueOrThrow.mockResolvedValue(
      redemptionRow({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        refundedAt: new Date(),
      }),
    );

    const result = await service.cancel(ADMIN_ID, REDEMPTION_ID, {});
    expect(result.status).toBe('CANCELLED');
    expect(prisma.rewardWallet.update).toHaveBeenCalledWith({
      where: { id: WALLET_ID },
      data: { gold: { increment: 5 } },
    });
    expect(prisma.rewardLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REFUND',
          goldDelta: 5,
          referenceId: REDEMPTION_ID,
        }),
      }),
    );
  });

  it('cancels an approved redemption and refunds', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'APPROVED' }),
    );
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.update.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardRedemption.findUniqueOrThrow.mockResolvedValue(
      redemptionRow({ status: 'CANCELLED' }),
    );

    await service.cancel(ADMIN_ID, REDEMPTION_ID, {
      cancellationReason: 'estoque',
    });
    expect(prisma.rewardLedgerEntry.create).toHaveBeenCalledTimes(1);
  });

  it('does not refund a redemption that is already cancelled', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'CANCELLED', refundedAt: new Date() }),
    );

    await expect(
      service.cancel(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rewardWallet.update).not.toHaveBeenCalled();
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('blocks a second concurrent cancel from refunding twice', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.cancel(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('blocks PENDING to DELIVERED', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    await expect(
      service.deliver(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks DELIVERED to PENDING/APPROVED', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'DELIVERED' }),
    );
    await expect(
      service.approve(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks CANCELLED to APPROVED', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'CANCELLED' }),
    );
    await expect(
      service.approve(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second admin approving the same redemption', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.approve(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second admin delivering the same redemption', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'APPROVED' }),
    );
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.deliver(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not cancel a delivered redemption', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(
      redemptionRow({ status: 'DELIVERED' }),
    );
    await expect(
      service.cancel(ADMIN_ID, REDEMPTION_ID, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rewardWallet.update).not.toHaveBeenCalled();
  });

  it('rolls back cancel when the refund ledger fails', async () => {
    prisma.rewardRedemption.findUnique.mockResolvedValue(redemptionRow());
    prisma.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.update.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockRejectedValue(new Error('ledger fail'));

    await expect(service.cancel(ADMIN_ID, REDEMPTION_ID, {})).rejects.toThrow(
      'ledger fail',
    );
  });
});
