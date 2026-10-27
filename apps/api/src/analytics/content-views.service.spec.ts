import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ContentViewsService } from './content-views.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const SESSION = '11111111-1111-4111-8111-111111111111';
const HUNT = '44444444-4444-4444-8444-444444444444';

describe('ContentViewsService', () => {
  let service: ContentViewsService;
  const prisma = {
    hunt: { findFirst: jest.fn() },
    creature: { findFirst: jest.fn() },
    contentViewEvent: { create: jest.fn() },
    searchMiss: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.hunt.findFirst.mockResolvedValue({ id: HUNT });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContentViewsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ContentViewsService);
  });

  it('stores one view and treats the hourly duplicate as already recorded', async () => {
    prisma.contentViewEvent.create.mockResolvedValueOnce({ id: 'view-1' });
    await expect(
      service.record({
        subject: 'HUNT',
        subjectId: HUNT,
        sessionKey: SESSION,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ recorded: true, duplicate: false });

    prisma.contentViewEvent.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      service.record({
        subject: 'HUNT',
        subjectId: HUNT,
        sessionKey: SESSION,
      }),
    ).resolves.toEqual({ recorded: false, duplicate: true });
    expect(prisma.contentViewEvent.create).toHaveBeenCalledTimes(2);
  });

  it('rejects a session key that is not a pseudonymous identifier', async () => {
    await expect(
      service.record({
        subject: 'HUNT',
        subjectId: HUNT,
        sessionKey: 'browser-fingerprint',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.contentViewEvent.create).not.toHaveBeenCalled();
  });
});
