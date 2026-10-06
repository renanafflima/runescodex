import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateHuntUpdateRequestDto,
  HUNT_UPDATE_REQUEST_MAX_LENGTH,
  HUNT_UPDATE_REQUEST_MIN_LENGTH,
} from './dto/create-hunt-update-request.dto';
import { HuntUpdateRequestsService } from './hunt-update-requests.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-10-05T12:00:00.000Z');
const description = 'O XP dessa hunt está desatualizado.';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'request-1',
    type: HuntUpdateRequestType.XP,
    description,
    status: HuntUpdateRequestStatus.OPEN,
    adminResponse: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

describe('HuntUpdateRequestsService', () => {
  let service: HuntUpdateRequestsService;
  const prisma = {
    hunt: { findFirst: jest.fn() },
    huntUpdateRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.hunt.findFirst.mockResolvedValue({ id: 'hunt-1' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        HuntUpdateRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HuntUpdateRequestsService);
  });

  it('creates an open request for the authenticated user', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue(null);
    prisma.huntUpdateRequest.create.mockResolvedValue(row());

    const result = await service.create('cyclops', 'user-a', {
      type: HuntUpdateRequestType.XP,
      description,
    });

    expect(result.status).toBe(HuntUpdateRequestStatus.OPEN);
    expect(prisma.huntUpdateRequest.create).toHaveBeenCalledWith({
      data: {
        huntId: 'hunt-1',
        userId: 'user-a',
        type: HuntUpdateRequestType.XP,
        description,
        status: HuntUpdateRequestStatus.OPEN,
      },
      select: {
        id: true,
        type: true,
        description: true,
        status: true,
        adminResponse: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
      },
    });
  });

  it('rejects a missing hunt', async () => {
    prisma.hunt.findFirst.mockResolvedValue(null);

    await expect(
      service.create('missing', 'user-a', {
        type: HuntUpdateRequestType.XP,
        description,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.huntUpdateRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a second open request of the same type', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue({ id: 'request-1' });

    await expect(
      service.create('cyclops', 'user-a', {
        type: HuntUpdateRequestType.XP,
        description,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.huntUpdateRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate while the same type is in review', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue({ id: 'request-1' });

    await expect(
      service.create('cyclops', 'user-a', {
        type: HuntUpdateRequestType.PROFIT,
        description,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.huntUpdateRequest.findFirst).toHaveBeenCalledWith({
      where: {
        huntId: 'hunt-1',
        userId: 'user-a',
        type: HuntUpdateRequestType.PROFIT,
        status: {
          in: [HuntUpdateRequestStatus.OPEN, HuntUpdateRequestStatus.IN_REVIEW],
        },
      },
      select: { id: true },
    });
  });

  it.each([HuntUpdateRequestStatus.RESOLVED, HuntUpdateRequestStatus.REJECTED])(
    'allows a new request after %s',
    async () => {
      prisma.huntUpdateRequest.findFirst.mockResolvedValue(null);
      prisma.huntUpdateRequest.create.mockResolvedValue(row());

      await service.create('cyclops', 'user-a', {
        type: HuntUpdateRequestType.XP,
        description,
      });

      expect(prisma.huntUpdateRequest.findFirst).toHaveBeenCalledWith({
        where: {
          huntId: 'hunt-1',
          userId: 'user-a',
          type: HuntUpdateRequestType.XP,
          status: {
            in: [
              HuntUpdateRequestStatus.OPEN,
              HuntUpdateRequestStatus.IN_REVIEW,
            ],
          },
        },
        select: { id: true },
      });
      expect(prisma.huntUpdateRequest.create).toHaveBeenCalledTimes(1);
    },
  );

  it('lists only the caller requests for that hunt', async () => {
    prisma.huntUpdateRequest.count.mockResolvedValue(1);
    prisma.huntUpdateRequest.findMany.mockResolvedValue([row()]);

    const result = await service.list('cyclops', 'user-a', {});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prisma.huntUpdateRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { huntId: 'hunt-1', userId: 'user-a' },
      }),
    );
  });

  it('returns an empty page when the user has no requests', async () => {
    prisma.huntUpdateRequest.count.mockResolvedValue(0);
    prisma.huntUpdateRequest.findMany.mockResolvedValue([]);

    const result = await service.list('cyclops', 'user-a', {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('rejects listing when the hunt does not exist', async () => {
    prisma.hunt.findFirst.mockResolvedValue(null);

    await expect(service.list('missing', 'user-a', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the caller request', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue(row());

    const result = await service.findOne('cyclops', 'request-1', 'user-a');

    expect(result.id).toBe('request-1');
    expect(prisma.huntUpdateRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1', huntId: 'hunt-1', userId: 'user-a' },
      }),
    );
  });

  it('does not reveal a request owned by someone else', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('cyclops', 'request-1', 'user-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.huntUpdateRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1', huntId: 'hunt-1', userId: 'user-b' },
      }),
    );
  });

  it('rejects a missing request', async () => {
    prisma.huntUpdateRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('cyclops', 'missing', 'user-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CreateHuntUpdateRequestDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  it('accepts a valid type and trims the description', async () => {
    const dto = plainToInstance(CreateHuntUpdateRequestDto, {
      type: HuntUpdateRequestType.XP,
      description: `  ${description}  `,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.description).toBe(description);
  });

  it('rejects an invalid type, an empty description, a short description, and an oversized description', async () => {
    const invalidType = plainToInstance(CreateHuntUpdateRequestDto, {
      type: 'GOLD',
      description,
    });
    const empty = plainToInstance(CreateHuntUpdateRequestDto, {
      type: HuntUpdateRequestType.XP,
      description: '   ',
    });
    const short = plainToInstance(CreateHuntUpdateRequestDto, {
      type: HuntUpdateRequestType.XP,
      description: 'a'.repeat(HUNT_UPDATE_REQUEST_MIN_LENGTH - 1),
    });
    const huge = plainToInstance(CreateHuntUpdateRequestDto, {
      type: HuntUpdateRequestType.XP,
      description: 'a'.repeat(HUNT_UPDATE_REQUEST_MAX_LENGTH + 1),
    });

    expect(await validate(invalidType)).not.toHaveLength(0);
    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(short)).not.toHaveLength(0);
    expect(await validate(huge)).not.toHaveLength(0);
  });

  it('rejects userId, status, adminResponse, and resolvedAt from the body', async () => {
    await expect(
      pipe.transform(
        {
          type: HuntUpdateRequestType.XP,
          description,
          userId: 'attacker',
          status: HuntUpdateRequestStatus.RESOLVED,
          adminResponse: 'aceito',
          resolvedAt: now.toISOString(),
        },
        { type: 'body', metatype: CreateHuntUpdateRequestDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
