import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
} from '../../generated/prisma/client.js';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHuntUpdateRequestDto } from './dto/create-hunt-update-request.dto';

const OPEN_STATUSES: HuntUpdateRequestStatus[] = [
  HuntUpdateRequestStatus.OPEN,
  HuntUpdateRequestStatus.IN_REVIEW,
];

export type HuntUpdateRequestView = {
  id: string;
  type: HuntUpdateRequestType;
  description: string;
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
    return this.prisma.huntUpdateRequest.create({
      data: {
        huntId: hunt.id,
        userId,
        type: dto.type,
        description: dto.description,
        status: HuntUpdateRequestStatus.OPEN,
      },
      select: REQUEST_SELECT,
    });
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
