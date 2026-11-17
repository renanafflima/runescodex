import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { AdMobRewardedService } from './admob-rewarded.service';
import * as verifier from './admob-ssv.verifier';

jest.mock('./admob-ssv.verifier', () => ({
  ...jest.requireActual('./admob-ssv.verifier'),
  loadAdMobVerifierKeys: jest.fn(),
  verifyAdMobSsvSignature: jest.fn(),
  parseAdMobSsvQuery: jest.fn(),
}));

describe('AdMobRewardedService', () => {
  let service: AdMobRewardedService;
  const rewards = { recordEvent: jest.fn().mockResolvedValue({ applied: [] }) };
  const prisma = {
    adMobRewardSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adMobSsvTransaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    rewardWallet: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    prisma.adMobSsvTransaction.count.mockResolvedValue(0);
    prisma.adMobSsvTransaction.findFirst.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdMobRewardedService,
        { provide: PrismaService, useValue: prisma },
        { provide: RewardsService, useValue: rewards },
      ],
    }).compile();

    service = moduleRef.get(AdMobRewardedService);
  });

  it('creates a rewarded session on prepare', async () => {
    prisma.adMobRewardSession.create.mockResolvedValue({
      id: 'sess-1',
      expiresAt: new Date('2026-11-13T00:15:00.000Z'),
    });

    const result = await service.prepareSession('user-1');

    expect(result.sessionId).toBe('sess-1');
    expect(result.customData).toBe('sess-1');
    expect(prisma.adMobRewardSession.create).toHaveBeenCalled();
  });

  it('rejects SSV with unknown ad unit', async () => {
    (verifier.loadAdMobVerifierKeys as jest.Mock).mockResolvedValue(new Map());
    (verifier.verifyAdMobSsvSignature as jest.Mock).mockImplementation(() => {});
    (verifier.parseAdMobSsvQuery as jest.Mock).mockReturnValue({
      adUnit: 'unexpected-unit',
      transactionId: 'tx-1',
      keyId: 1,
      customData: 'sess-1',
    });
    prisma.adMobSsvTransaction.findUnique.mockResolvedValue(null);

    await expect(
      service.handleSsvCallback('ad_unit=unexpected-unit&signature=x&key_id=1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns duplicate when transaction already exists', async () => {
    (verifier.loadAdMobVerifierKeys as jest.Mock).mockResolvedValue(new Map());
    (verifier.verifyAdMobSsvSignature as jest.Mock).mockImplementation(() => {});
    (verifier.parseAdMobSsvQuery as jest.Mock).mockReturnValue({
      adUnit: 'ca-app-pub-3940256099942544/5224354917',
      transactionId: 'tx-dup',
      keyId: 1,
      customData: 'sess-1',
    });
    prisma.adMobSsvTransaction.findUnique.mockResolvedValue({ transactionId: 'tx-dup' });

    const result = await service.handleSsvCallback('ignored');
    expect(result.status).toBe('duplicate');
    expect(rewards.recordEvent).not.toHaveBeenCalled();
  });

  it('processes a valid SSV callback once', async () => {
    (verifier.loadAdMobVerifierKeys as jest.Mock).mockResolvedValue(new Map());
    (verifier.verifyAdMobSsvSignature as jest.Mock).mockImplementation(() => {});
    (verifier.parseAdMobSsvQuery as jest.Mock).mockReturnValue({
      adUnit: 'ca-app-pub-3940256099942544/5224354917',
      transactionId: 'tx-new',
      keyId: 1,
      customData: 'sess-1',
      timestamp: '1730000000000',
    });
    prisma.adMobSsvTransaction.findUnique.mockResolvedValue(null);
    prisma.adMobRewardSession.findUnique.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    prisma.adMobSsvTransaction.create.mockResolvedValue({ transactionId: 'tx-new' });
    prisma.adMobRewardSession.update.mockResolvedValue({});

    const result = await service.handleSsvCallback('ignored');

    expect(result.status).toBe('processed');
    expect(rewards.recordEvent).toHaveBeenCalledWith(
      'user-1',
      'WATCH_AD',
      expect.objectContaining({
        referenceType: 'AdMobSsvTransaction',
        referenceId: 'tx-new',
      }),
      expect.any(Date),
      prisma,
    );
  });
});
