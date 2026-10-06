import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ListAdminHuntUpdateRequestsQueryDto } from './dto/list-admin-hunt-update-requests-query.dto';
import { UpdateAdminHuntUpdateRequestDto } from './dto/update-admin-hunt-update-request.dto';

const NEXT_STATUS: Record<HuntUpdateRequestStatus, HuntUpdateRequestStatus[]> =
  {
    OPEN: [HuntUpdateRequestStatus.IN_REVIEW, HuntUpdateRequestStatus.REJECTED],
    IN_REVIEW: [
      HuntUpdateRequestStatus.RESOLVED,
      HuntUpdateRequestStatus.REJECTED,
    ],
    RESOLVED: [],
    REJECTED: [],
  };

const CLOSED = new Set<HuntUpdateRequestStatus>([
  HuntUpdateRequestStatus.RESOLVED,
  HuntUpdateRequestStatus.REJECTED,
]);

export type AdminHuntUpdateRequestView = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  hunt: { id: string; name: string; slug: string };
  user: { id: string; name: string | null };
};

const REQUEST_SELECT = {
  id: true,
  type: true,
  description: true,
  status: true,
  adminResponse: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  hunt: { select: { id: true, name: true, slug: true } },
  user: {
    select: {
      id: true,
      activeCharacter: { select: { name: true } },
    },
  },
} as const;

type RequestRow = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  hunt: { id: string; name: string; slug: string };
  user: { id: string; activeCharacter: { name: string } | null };
};

@Injectable()
export class HuntUpdateRequestsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminHuntUpdateRequestsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              {
                hunt: {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                hunt: {
                  slug: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                user: {
                  activeCharacter: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.huntUpdateRequest.count({ where }),
      this.prisma.huntUpdateRequest.findMany({
        where,
        select: REQUEST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => this.serialize(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<AdminHuntUpdateRequestView> {
    const row = await this.prisma.huntUpdateRequest.findUnique({
      where: { id },
      select: REQUEST_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    return this.serialize(row);
  }

  async update(
    id: string,
    dto: UpdateAdminHuntUpdateRequestDto,
  ): Promise<AdminHuntUpdateRequestView> {
    if (dto.status === undefined && dto.adminResponse === undefined) {
      throw new BadRequestException('Informe um status ou uma resposta.');
    }
    const current = await this.prisma.huntUpdateRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (CLOSED.has(current.status)) {
      throw new BadRequestException('Esta solicitação já foi encerrada.');
    }
    const nextStatus = dto.status ?? current.status;
    if (
      dto.status !== undefined &&
      dto.status !== current.status &&
      !NEXT_STATUS[current.status].includes(dto.status)
    ) {
      throw new BadRequestException('Esta mudança de status não é permitida.');
    }
    const closing = CLOSED.has(nextStatus);
    const updated = await this.prisma.huntUpdateRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(dto.adminResponse !== undefined
          ? { adminResponse: dto.adminResponse }
          : {}),
        resolvedAt: closing ? new Date() : null,
      },
      select: REQUEST_SELECT,
    });
    return this.serialize(updated);
  }

  private serialize(row: RequestRow): AdminHuntUpdateRequestView {
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      status: row.status,
      adminResponse: row.adminResponse,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      hunt: row.hunt,
      user: {
        id: row.user.id,
        name: row.user.activeCharacter?.name ?? null,
      },
    };
  }
}
