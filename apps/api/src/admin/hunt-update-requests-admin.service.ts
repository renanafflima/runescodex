import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  HuntUpdateRequestStatus,
  HuntUpdateRequestType,
  Prisma,
  Vocation,
} from '../../generated/prisma/client.js';
import {
  assertHuntVocation,
  huntVocationProposalData,
  isAutoApplicableHuntUpdate,
  parseProposedHuntNumber,
} from '../hunts/hunt-field-proposal';
import { AdminAuditService } from '../audit/admin-audit.service';
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
  currentValue: string | null;
  proposedValue: string | null;
  vocation: Vocation | null;
  ticketId: string | null;
  appliedAt: Date | null;
  autoApplicable: boolean;
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
  currentValue: true,
  proposedValue: true,
  vocation: true,
  ticketId: true,
  appliedAt: true,
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
  currentValue: string | null;
  proposedValue: string | null;
  vocation: Vocation | null;
  ticketId: string | null;
  appliedAt: Date | null;
  status: HuntUpdateRequestStatus;
  adminResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  hunt: { id: string; name: string; slug: string };
  user: { id: string; activeCharacter: { name: string } | null };
};

type ProposalRow = {
  id: string;
  huntId: string;
  type: HuntUpdateRequestType;
  proposedValue: string | null;
  vocation: Vocation | null;
  appliedAt: Date | null;
};

@Injectable()
export class HuntUpdateRequestsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AdminAuditService,
  ) {}

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
    actorId: string,
    id: string,
    dto: UpdateAdminHuntUpdateRequestDto,
  ): Promise<AdminHuntUpdateRequestView> {
    if (
      dto.status === undefined &&
      dto.adminResponse === undefined &&
      dto.ticketId === undefined
    ) {
      throw new BadRequestException('Informe um status ou uma resposta.');
    }
    const current = await this.prisma.huntUpdateRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        huntId: true,
        type: true,
        proposedValue: true,
        vocation: true,
        appliedAt: true,
      },
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
    if (dto.ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: dto.ticketId },
        select: { id: true, huntId: true },
      });
      if (!ticket) {
        throw new NotFoundException('Chamado relacionado não encontrado.');
      }
      if (ticket.huntId && ticket.huntId !== current.huntId) {
        throw new BadRequestException('O chamado pertence a outra Hunt.');
      }
    }
    const closing = CLOSED.has(nextStatus);
    const applying =
      nextStatus === HuntUpdateRequestStatus.RESOLVED &&
      Boolean(current.proposedValue) &&
      !current.appliedAt &&
      isAutoApplicableHuntUpdate(current.type);
    const data = {
      status: nextStatus,
      ...(dto.adminResponse !== undefined
        ? { adminResponse: dto.adminResponse }
        : {}),
      ...(dto.ticketId !== undefined ? { ticketId: dto.ticketId } : {}),
      resolvedAt: closing ? new Date() : null,
      ...(closing ? { decidedByUserId: actorId } : {}),
    };
    const updated = applying
      ? await this.resolveApplied(actorId, current, data)
      : await this.prisma.huntUpdateRequest.update({
          where: { id },
          data,
          select: REQUEST_SELECT,
        });
    if (!applying) {
      await this.audit?.record({
        actorUserId: actorId,
        action: 'hunt_update.status',
        entityType: 'hunt_update_request',
        entityId: id,
        summary: `Status ${current.status} → ${nextStatus}`,
        metadata: { from: current.status, to: nextStatus, applied: false },
      });
    }
    return this.serialize(updated);
  }

  private async resolveApplied(
    actorId: string,
    current: ProposalRow,
    data: Prisma.HuntUpdateRequestUncheckedUpdateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.huntUpdateRequest.findUnique({
        where: { id: current.id },
        select: {
          id: true,
          huntId: true,
          type: true,
          proposedValue: true,
          vocation: true,
          appliedAt: true,
          status: true,
        },
      });
      if (!fresh || CLOSED.has(fresh.status) || fresh.appliedAt) {
        throw new BadRequestException(
          'Esta correção já foi aplicada ou encerrada.',
        );
      }
      const applied = await this.applyProposal(tx, fresh);
      const updated = await tx.huntUpdateRequest.update({
        where: { id: current.id },
        data: {
          ...data,
          ...(applied ? { appliedAt: new Date() } : {}),
        },
        select: REQUEST_SELECT,
      });
      await this.audit?.record(
        {
          actorUserId: actorId,
          action: 'hunt_update.apply',
          entityType: 'hunt_update_request',
          entityId: current.id,
          summary: applied
            ? `Correção aplicada em ${current.type}`
            : `Status alterado sem alterar a Hunt`,
          metadata: {
            type: current.type,
            vocation: current.vocation,
            applied,
          },
        },
        tx,
      );
      return updated;
    });
  }

  private async applyProposal(
    tx: Prisma.TransactionClient,
    current: ProposalRow,
  ) {
    if (!current.proposedValue) return false;
    if (current.type === HuntUpdateRequestType.LOCATION) {
      const location = current.proposedValue.trim();
      if (location.length < 2 || location.length > 120) {
        throw new BadRequestException(
          'A localização proposta precisa ter entre 2 e 120 caracteres.',
        );
      }
      await tx.hunt.update({
        where: { id: current.huntId },
        data: { location },
      });
      return true;
    }
    if (
      current.type !== HuntUpdateRequestType.XP &&
      current.type !== HuntUpdateRequestType.PROFIT &&
      current.type !== HuntUpdateRequestType.LEVEL
    ) {
      return false;
    }
    const vocation = assertHuntVocation(current.vocation);
    const value = parseProposedHuntNumber(current.type, current.proposedValue);
    const written = await tx.huntVocation.updateMany({
      where: { huntId: current.huntId, vocation },
      data: huntVocationProposalData(current.type, value),
    });
    if (written.count !== 1) {
      throw new BadRequestException(
        'Esta Hunt não tem a vocação informada na proposta.',
      );
    }
    return true;
  }

  private serialize(row: RequestRow): AdminHuntUpdateRequestView {
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      currentValue: row.currentValue ?? null,
      proposedValue: row.proposedValue ?? null,
      vocation: row.vocation ?? null,
      ticketId: row.ticketId ?? null,
      appliedAt: row.appliedAt ?? null,
      autoApplicable:
        Boolean(row.proposedValue) && isAutoApplicableHuntUpdate(row.type),
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
