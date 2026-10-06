import {
  BadRequestException,
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
import { ListAdminHuntUpdateRequestsQueryDto } from './dto/list-admin-hunt-update-requests-query.dto';
import {
  ADMIN_HUNT_UPDATE_RESPONSE_MAX_LENGTH,
  UpdateAdminHuntUpdateRequestDto,
} from './dto/update-admin-hunt-update-request.dto';
import { HuntUpdateRequestsAdminService } from './hunt-update-requests-admin.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-10-05T12:00:00.000Z');

function row(status: HuntUpdateRequestStatus = HuntUpdateRequestStatus.OPEN) {
  return {
    id: 'request-1',
    type: HuntUpdateRequestType.XP,
    description: 'O XP dessa hunt está desatualizado.',
    status,
    adminResponse: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    hunt: { id: 'hunt-1', name: 'Orc Fortress', slug: 'orc-fortress' },
    user: { id: 'user-1', activeCharacter: { name: 'Renan' } },
  };
}

describe('HuntUpdateRequestsAdminService', () => {
  let service: HuntUpdateRequestsAdminService;
  const prisma = {
    huntUpdateRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HuntUpdateRequestsAdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HuntUpdateRequestsAdminService);
  });

  it('lists requests with pagination, status, type, and search', async () => {
    prisma.huntUpdateRequest.count.mockResolvedValue(21);
    prisma.huntUpdateRequest.findMany.mockResolvedValue([row()]);

    const result = await service.list({
      page: 2,
      limit: 20,
      status: HuntUpdateRequestStatus.IN_REVIEW,
      type: HuntUpdateRequestType.XP,
      search: 'Orc',
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(21);
    expect(result.hasMore).toBe(false);
    expect(result.items[0]?.user).toEqual({ id: 'user-1', name: 'Renan' });
    expect(result.items[0]?.hunt.slug).toBe('orc-fortress');
    expect(prisma.huntUpdateRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: HuntUpdateRequestStatus.IN_REVIEW,
          type: HuntUpdateRequestType.XP,
          OR: [
            { hunt: { name: { contains: 'Orc', mode: 'insensitive' } } },
            { hunt: { slug: { contains: 'Orc', mode: 'insensitive' } } },
            {
              user: {
                activeCharacter: {
                  name: { contains: 'Orc', mode: 'insensitive' },
                },
              },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 20,
      }),
    );
  });

  it('returns one request and rejects a missing id', async () => {
    prisma.huntUpdateRequest.findUnique.mockResolvedValueOnce(row());
    const found = await service.findOne('request-1');
    expect(found.id).toBe('request-1');

    prisma.huntUpdateRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('moves an open request to review and clears resolvedAt', async () => {
    prisma.huntUpdateRequest.findUnique.mockResolvedValue(
      row(HuntUpdateRequestStatus.OPEN),
    );
    prisma.huntUpdateRequest.update.mockResolvedValue(
      row(HuntUpdateRequestStatus.IN_REVIEW),
    );

    await service.update('request-1', {
      status: HuntUpdateRequestStatus.IN_REVIEW,
    });

    expect(prisma.huntUpdateRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-1' },
        data: {
          status: HuntUpdateRequestStatus.IN_REVIEW,
          resolvedAt: null,
        },
      }),
    );
  });

  it.each([HuntUpdateRequestStatus.RESOLVED, HuntUpdateRequestStatus.REJECTED])(
    'closes a request as %s and stores the response',
    async (status) => {
      prisma.huntUpdateRequest.findUnique.mockResolvedValue(
        row(HuntUpdateRequestStatus.IN_REVIEW),
      );
      prisma.huntUpdateRequest.update.mockImplementation(
        ({ data }: { data: { resolvedAt: Date } }) =>
          Promise.resolve({
            ...row(status),
            adminResponse: 'XP atualizado.',
            resolvedAt: data.resolvedAt,
          }),
      );

      const result = await service.update('request-1', {
        status,
        adminResponse: 'XP atualizado.',
      });

      expect(result.status).toBe(status);
      expect(result.adminResponse).toBe('XP atualizado.');
      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(prisma.huntUpdateRequest.update).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an incoherent transition and a closed request', async () => {
    prisma.huntUpdateRequest.findUnique.mockResolvedValue(
      row(HuntUpdateRequestStatus.OPEN),
    );
    await expect(
      service.update('request-1', {
        status: HuntUpdateRequestStatus.RESOLVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.huntUpdateRequest.findUnique.mockResolvedValue(
      row(HuntUpdateRequestStatus.RESOLVED),
    );
    await expect(
      service.update('request-1', {
        adminResponse: 'Nova resposta',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.huntUpdateRequest.update).not.toHaveBeenCalled();
  });
});

describe('admin hunt update request DTOs', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  it('rejects userId, huntId, createdAt, and resolvedAt', async () => {
    await expect(
      pipe.transform(
        {
          status: HuntUpdateRequestStatus.IN_REVIEW,
          userId: 'attacker',
          huntId: 'hunt-1',
          createdAt: now.toISOString(),
          resolvedAt: now.toISOString(),
        },
        { type: 'body', metatype: UpdateAdminHuntUpdateRequestDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims a response and rejects an empty or oversized one', async () => {
    const valid = plainToInstance(UpdateAdminHuntUpdateRequestDto, {
      adminResponse: '  XP atualizado.  ',
    });
    const empty = plainToInstance(UpdateAdminHuntUpdateRequestDto, {
      adminResponse: '   ',
    });
    const huge = plainToInstance(UpdateAdminHuntUpdateRequestDto, {
      adminResponse: 'a'.repeat(ADMIN_HUNT_UPDATE_RESPONSE_MAX_LENGTH + 1),
    });
    const query = plainToInstance(ListAdminHuntUpdateRequestsQueryDto, {
      search: '  orc  ',
      status: HuntUpdateRequestStatus.OPEN,
      type: HuntUpdateRequestType.LOOT,
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(valid.adminResponse).toBe('XP atualizado.');
    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(huge)).not.toHaveLength(0);
    expect(await validate(query)).toHaveLength(0);
    expect(query.search).toBe('orc');
  });
});
