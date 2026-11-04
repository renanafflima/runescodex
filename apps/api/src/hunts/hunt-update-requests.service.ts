import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
  Vocation,
} from '../../generated/prisma/client.js';
import {
  assertHuntVocation,
  isAutoApplicableHuntUpdate,
  parseProposedHuntNumber,
} from './hunt-field-proposal';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHuntUpdateRequestDto } from './dto/create-hunt-update-request.dto';
import {
  countHuntVocationRanges,
  huntVocationRangeWhere,
  type HuntVocationRangeKey,
} from './hunt-vocation-range';

const OPEN_STATUSES: HuntUpdateRequestStatus[] = [
  HuntUpdateRequestStatus.OPEN,
  HuntUpdateRequestStatus.IN_REVIEW,
];

export type HuntUpdateRequestView = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
  currentValue: string | null;
  proposedValue: string | null;
  vocation: Vocation | null;
  appliedAt: Date | null;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

const REQUEST_SELECT = {
  id: true,
  type: true,
  description: true,
  currentValue: true,
  proposedValue: true,
  vocation: true,
  appliedAt: true,
  status: true,
  adminResponse: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
} as const;

@Injectable()
export class HuntUpdateRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(slug: string, userId: string, query: PageQueryDto) {
    const hunt = await this.requireHunt(slug);
    const { page, limit, skip } = resolvePage(query);
    const where = { huntId: hunt.id, userId };
    const [total, items] = await Promise.all([
      this.prisma.huntUpdateRequest.count({ where }),
      this.prisma.huntUpdateRequest.findMany({
        where,
        select: REQUEST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(items, total, page, limit);
  }

  async findOne(slug: string, requestId: string, userId: string) {
    const hunt = await this.requireHunt(slug);
    const request = await this.prisma.huntUpdateRequest.findFirst({
      where: { id: requestId, huntId: hunt.id, userId },
      select: REQUEST_SELECT,
    });
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    return request;
  }

  async create(slug: string, userId: string, dto: CreateHuntUpdateRequestDto) {
    const hunt = await this.requireHunt(slug);
    const existing = await this.prisma.huntUpdateRequest.findFirst({
      where: {
        huntId: hunt.id,
        userId,
        type: dto.type,
        status: { in: OPEN_STATUSES },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Você já tem uma solicitação em aberto deste tipo para esta hunt.',
      );
    }
    const proposal = await this.snapshot(hunt.id, dto);
    return this.prisma.huntUpdateRequest.create({
      data: {
        huntId: hunt.id,
        userId,
        type: dto.type,
        description: dto.description,
        status: HuntUpdateRequestStatus.OPEN,
        currentValue: proposal.currentValue,
        proposedValue: proposal.proposedValue,
        vocation: proposal.vocation,
        rangeLevelMin: proposal.rangeLevelMin,
        rangeLevelMax: proposal.rangeLevelMax,
      },
      select: REQUEST_SELECT,
    });
  }

  private async snapshot(huntId: string, dto: CreateHuntUpdateRequestDto) {
    const proposedValue = dto.proposedValue ?? null;
    const vocation = dto.vocation ?? null;
    const numericType =
      dto.type === HuntUpdateRequestType.XP ||
      dto.type === HuntUpdateRequestType.PROFIT ||
      dto.type === HuntUpdateRequestType.LEVEL
        ? dto.type
        : null;
    if (proposedValue && numericType) {
      assertHuntVocation(vocation);
      parseProposedHuntNumber(numericType, proposedValue);
    }
    if (proposedValue && dto.type === HuntUpdateRequestType.LOCATION) {
      if (proposedValue.length < 2) {
        throw new BadRequestException(
          'A localização proposta precisa ter pelo menos 2 caracteres.',
        );
      }
    }
    if (
      proposedValue &&
      !numericType &&
      dto.type !== HuntUpdateRequestType.LOCATION &&
      !isAutoApplicableHuntUpdate(dto.type)
    ) {
      throw new BadRequestException(
        'Este tipo de solicitação não aceita um valor estruturado. Descreva a alteração no texto.',
      );
    }
    let currentValue: string | null = null;
    let rangeLevelMin: number | null = null;
    let rangeLevelMax: number | null = null;
    if (numericType && vocation) {
      const range = await this.resolveProposalRange(huntId, vocation, dto);
      rangeLevelMin = range.levelMin;
      rangeLevelMax = range.levelMax;
      const stats = await this.prisma.huntVocation.findFirst({
        where: huntVocationRangeWhere(huntId, vocation, range),
        select: { xpPerHour: true, profitPerHour: true, levelMin: true },
      });
      if (!stats) {
        throw new BadRequestException('Esta Hunt não tem a vocação informada.');
      }
      currentValue = String(
        dto.type === HuntUpdateRequestType.XP
          ? stats.xpPerHour
          : dto.type === HuntUpdateRequestType.PROFIT
            ? stats.profitPerHour
            : stats.levelMin,
      );
    }
    if (dto.type === HuntUpdateRequestType.LOCATION) {
      const hunt = await this.prisma.hunt.findUnique({
        where: { id: huntId },
        select: { location: true },
      });
      currentValue = hunt?.location ?? null;
    }
    return {
      currentValue,
      proposedValue,
      vocation,
      rangeLevelMin,
      rangeLevelMax,
    };
  }

  private async resolveProposalRange(
    huntId: string,
    vocation: Vocation,
    dto: CreateHuntUpdateRequestDto,
  ): Promise<HuntVocationRangeKey> {
    const total = await countHuntVocationRanges(this.prisma, huntId, vocation);
    if (total === 0) {
      throw new BadRequestException('Esta Hunt não tem a vocação informada.');
    }
    if (dto.rangeLevelMin != null) {
      const row = await this.prisma.huntVocation.findFirst({
        where:
          dto.rangeLevelMax !== undefined
            ? huntVocationRangeWhere(huntId, vocation, {
                levelMin: dto.rangeLevelMin,
                levelMax: dto.rangeLevelMax,
              })
            : { huntId, vocation, levelMin: dto.rangeLevelMin },
        select: { levelMin: true, levelMax: true },
      });
      if (!row) {
        throw new BadRequestException(
          'A faixa de level informada não existe para esta vocação nesta Hunt.',
        );
      }
      return { levelMin: row.levelMin, levelMax: row.levelMax };
    }
    if (total > 1) {
      throw new BadRequestException(
        'Informe a faixa de level (rangeLevelMin) desta vocação para abrir a solicitação.',
      );
    }
    const only = await this.prisma.huntVocation.findFirst({
      where: { huntId, vocation },
      select: { levelMin: true, levelMax: true },
    });
    if (!only) {
      throw new BadRequestException('Esta Hunt não tem a vocação informada.');
    }
    return { levelMin: only.levelMin, levelMax: only.levelMax };
  }

  private async requireHunt(slug: string) {
    const hunt = await this.prisma.hunt.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!hunt) {
      throw new NotFoundException('Hunt not found');
    }
    return hunt;
  }
}
