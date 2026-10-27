import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TicketPriority,
  TicketStatus,
  TicketVocation,
} from '../../../generated/prisma/client.js';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { pageResult, resolvePage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_TICKET_STATUSES } from '../../tickets/ticket-status';
import { TicketsService } from '../../tickets/tickets.service';
import type {
  ApplyAdminTicketCorrectionDto,
  AssignAdminTicketDto,
  CreateAdminTicketMessageDto,
  ListAdminTicketsQueryDto,
  UpdateAdminTicketPriorityDto,
} from './admin-tickets.dto';

const HUNT_VOCATIONS = new Set(['EK', 'RP', 'ED', 'MS', 'EM']);
const APPLY_FIELDS = {
  XP_PER_HOUR: 'xpPerHour',
  PROFIT: 'profitPerHour',
  LEVEL: 'levelMin',
} as const;

const PERSON = {
  select: {
    id: true,
    activeCharacter: { select: { name: true } },
  },
} as const;

@Injectable()
export class AdminTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(actorId: string, query: ListAdminTicketsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = this.where(actorId, query);
    const orderBy =
      query.sort === 'priority'
        ? [{ priority: 'desc' as const }, { updatedAt: 'desc' as const }]
        : [
            { [query.sort || 'updatedAt']: 'desc' as const },
            { id: 'desc' as const },
          ];
    const [total, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          author: PERSON,
          assignee: PERSON,
          hunt: { select: { id: true, name: true, slug: true } },
          creature: { select: { id: true, name: true, slug: true } },
          _count: { select: { messages: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);
    const summary = await this.summary();
    return {
      ...pageResult(
        rows.map((row) => ({
          id: row.id,
          protocol: row.protocol,
          status: row.status,
          priority: row.priority,
          problemType: row.problemType,
          origin: row.origin,
          subject: row.description.slice(0, 140),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          messageCount: row._count.messages,
          author: this.person(row.author),
          assignee: row.assignee ? this.person(row.assignee) : null,
          hunt: row.hunt,
          creature: row.creature,
        })),
        total,
        page,
        limit,
      ),
      summary,
    };
  }

  async summary() {
    const [statuses, priorities] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: { status: { in: ACTIVE_TICKET_STATUSES } },
        _count: { _all: true },
      }),
    ]);
    const statusCount = Object.fromEntries(
      statuses.map((row) => [row.status, row._count._all]),
    );
    const priorityCount = Object.fromEntries(
      priorities.map((row) => [row.priority, row._count._all]),
    );
    return {
      scope: 'snapshot' as const,
      definition:
        'Contagem da fila inteira neste momento. Não usa o período do dashboard.',
      statuses: {
        OPEN: statusCount.OPEN ?? 0,
        IN_REVIEW: statusCount.IN_REVIEW ?? 0,
        WAITING_ON_USER: statusCount.WAITING_ON_USER ?? 0,
        WAITING_ON_STAFF: statusCount.WAITING_ON_STAFF ?? 0,
        RESOLVED: statusCount.RESOLVED ?? 0,
        REJECTED: statusCount.REJECTED ?? 0,
      },
      priorities: {
        LOW: priorityCount.LOW ?? 0,
        NORMAL: priorityCount.NORMAL ?? 0,
        HIGH: priorityCount.HIGH ?? 0,
        URGENT: priorityCount.URGENT ?? 0,
      },
    };
  }

  async detail(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        author: PERSON,
        assignee: PERSON,
        resolvedBy: PERSON,
        hunt: {
          select: {
            id: true,
            name: true,
            slug: true,
            location: true,
            subLocation: true,
            difficulty: true,
            description: true,
            isActive: true,
            vocations: {
              select: {
                vocation: true,
                levelMin: true,
                levelMax: true,
                xpPerHour: true,
                profitPerHour: true,
              },
              orderBy: { vocation: 'asc' },
            },
          },
        },
        creature: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            hp: true,
            experience: true,
            difficulty: true,
            description: true,
          },
        },
        vocations: { select: { vocation: true } },
        evidences: {
          select: {
            id: true,
            mimeType: true,
            source: true,
            byteSize: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        messages: {
          select: {
            id: true,
            visibility: true,
            body: true,
            createdAt: true,
            author: PERSON,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    return {
      ...ticket,
      author: this.person(ticket.author),
      assignee: ticket.assignee ? this.person(ticket.assignee) : null,
      resolvedBy: ticket.resolvedBy ? this.person(ticket.resolvedBy) : null,
      vocations: ticket.vocations.map((row) => row.vocation),
      messages: ticket.messages.map((message) => ({
        id: message.id,
        visibility: message.visibility,
        body: message.body,
        createdAt: message.createdAt,
        author: this.person(message.author),
      })),
      description: ticket.description,
    };
  }

  async staff() {
    const rows = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, activeCharacter: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((row) => this.person(row));
  }

  async addMessage(
    actorId: string,
    ticketId: string,
    dto: CreateAdminTicketMessageDto,
  ) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Escreva a mensagem.');
    const expected = new Date(dto.expectedUpdatedAt);
    const message = await this.prisma.$transaction(async (tx) => {
      const current = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          updatedAt: true,
          firstResponseAt: true,
          status: true,
        },
      });
      if (!current) throw new NotFoundException('Chamado não encontrado.');
      if (current.updatedAt.getTime() !== expected.getTime()) {
        throw new ConflictException(
          'O chamado foi atualizado por outra pessoa.',
        );
      }
      const created = await tx.ticketMessage.create({
        data: {
          ticketId,
          authorId: actorId,
          visibility: dto.visibility,
          body,
        },
        select: { id: true, visibility: true, createdAt: true },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          ...(dto.visibility === 'PUBLIC' && !current.firstResponseAt
            ? { firstResponseAt: created.createdAt }
            : {}),
        },
      });
      await this.audit.record(
        {
          actorUserId: actorId,
          action:
            dto.visibility === 'INTERNAL' ? 'ticket.note' : 'ticket.reply',
          entityType: 'ticket',
          entityId: ticketId,
          summary:
            dto.visibility === 'INTERNAL'
              ? 'Nota interna registrada'
              : 'Resposta pública enviada',
        },
        tx,
      );
      return created;
    });
    return message;
  }

  async assign(actorId: string, ticketId: string, dto: AssignAdminTicketDto) {
    if (dto.assigneeId === undefined) {
      throw new BadRequestException(
        'Informe o responsável ou null para remover.',
      );
    }
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
        select: { role: true },
      });
      if (!assignee || assignee.role !== 'ADMIN') {
        throw new BadRequestException(
          'O responsável precisa ser um administrador.',
        );
      }
    }
    await this.updateCurrent(ticketId, dto.expectedUpdatedAt, {
      assigneeId: dto.assigneeId,
    });
    await this.audit.record({
      actorUserId: actorId,
      action: 'ticket.assign',
      entityType: 'ticket',
      entityId: ticketId,
      summary: dto.assigneeId
        ? 'Responsável atribuído'
        : 'Responsável removido',
      metadata: { assigneeId: dto.assigneeId },
    });
    return this.detail(ticketId);
  }

  async priority(
    actorId: string,
    ticketId: string,
    dto: UpdateAdminTicketPriorityDto,
  ) {
    const urgentReason =
      dto.priority === 'URGENT' ? dto.urgentReason?.trim() || null : null;
    if (
      dto.priority === 'URGENT' &&
      (!urgentReason || urgentReason.length < 10)
    ) {
      throw new BadRequestException(
        'A prioridade urgente exige uma justificativa.',
      );
    }
    await this.updateCurrent(ticketId, dto.expectedUpdatedAt, {
      priority: dto.priority,
      urgentReason,
    });
    await this.audit.record({
      actorUserId: actorId,
      action: 'ticket.priority',
      entityType: 'ticket',
      entityId: ticketId,
      summary: `Prioridade alterada para ${dto.priority}`,
      metadata: { priority: dto.priority },
    });
    return this.detail(ticketId);
  }

  changeStatus(
    actorId: string,
    ticketId: string,
    dto: {
      status: TicketStatus;
      resolutionNote?: string;
      expectedUpdatedAt?: string;
    },
  ) {
    return this.tickets.updateStatus(actorId, ticketId, dto);
  }

  reopen(actorId: string, ticketId: string, reason: string) {
    return this.tickets.reopen(actorId, ticketId, reason);
  }

  async applyCorrection(
    actorId: string,
    ticketId: string,
    dto: ApplyAdminTicketCorrectionDto,
  ) {
    const expected = new Date(dto.expectedUpdatedAt);
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { vocations: { select: { vocation: true } } },
      });
      if (!ticket) throw new NotFoundException('Chamado não encontrado.');
      if (ticket.updatedAt.getTime() !== expected.getTime()) {
        throw new ConflictException(
          'O chamado foi atualizado por outra pessoa.',
        );
      }
      if (ticket.contentAppliedAt) {
        return { alreadyApplied: true, appliedAt: ticket.contentAppliedAt };
      }
      if (!ticket.huntId) {
        throw new BadRequestException(
          'Este chamado não está ligado a uma Hunt.',
        );
      }
      if (ticket.status === 'REJECTED' || ticket.status === 'OPEN') {
        throw new BadRequestException(
          'Coloque o chamado em atendimento antes de aplicar a correção.',
        );
      }
      const field =
        APPLY_FIELDS[ticket.problemType as keyof typeof APPLY_FIELDS];
      if (!field) {
        throw new BadRequestException(
          'Este tipo de chamado não tem um campo numérico aplicável.',
        );
      }
      const value = this.parseValue(field, ticket.userValue);
      const vocations = ticket.vocations
        .map((row) => row.vocation)
        .filter((vocation): vocation is Exclude<TicketVocation, 'MONK'> =>
          HUNT_VOCATIONS.has(vocation),
        );
      if (vocations.length === 0) {
        throw new BadRequestException(
          'Informe uma vocação de Hunt para aplicar o valor. Monk não faz parte da ficha da Hunt.',
        );
      }
      const updated = await tx.huntVocation.updateMany({
        where: { huntId: ticket.huntId, vocation: { in: vocations } },
        data: { [field]: value },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          'Nenhuma ficha de vocação correspondente foi encontrada.',
        );
      }
      const appliedAt = new Date();
      await tx.ticket.update({
        where: { id: ticketId },
        data: { contentAppliedAt: appliedAt },
      });
      await this.audit.record(
        {
          actorUserId: actorId,
          action: 'ticket.apply_correction',
          entityType: 'hunt',
          entityId: ticket.huntId,
          summary: `Correção aplicada em ${updated.count} vocação(ões)`,
          metadata: {
            ticketId,
            field,
            value,
            vocations,
          },
        },
        tx,
      );
      return { alreadyApplied: false, appliedAt, updated: updated.count };
    });
  }

  private async updateCurrent(
    ticketId: string,
    expectedUpdatedAt: string,
    data: Prisma.TicketUncheckedUpdateManyInput,
  ) {
    const expected = new Date(expectedUpdatedAt);
    const moved = await this.prisma.ticket.updateMany({
      where: { id: ticketId, updatedAt: expected },
      data,
    });
    if (moved.count !== 1) {
      const exists = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Chamado não encontrado.');
      throw new ConflictException('O chamado foi atualizado por outra pessoa.');
    }
  }

  private parseValue(field: string, raw: string | null) {
    if (!raw || !/^-?\d+$/.test(raw.trim())) {
      throw new BadRequestException(
        'O valor sugerido precisa ser um número inteiro, sem sufixos.',
      );
    }
    const value = Number(raw.trim());
    if (field === 'levelMin' && (value < 1 || value > 10_000)) {
      throw new BadRequestException('Level fora da faixa aceita.');
    }
    if (field === 'xpPerHour' && (value < 0 || value > 50_000_000)) {
      throw new BadRequestException('XP/h fora da faixa aceita.');
    }
    if (
      field === 'profitPerHour' &&
      (value < -50_000_000 || value > 50_000_000)
    ) {
      throw new BadRequestException('Lucro/h fora da faixa aceita.');
    }
    return value;
  }

  private where(
    actorId: string,
    query: ListAdminTicketsQueryDto,
  ): Prisma.TicketWhereInput {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const dateField =
      query.dateField === 'updatedAt' ? 'updatedAt' : 'createdAt';
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.problemType ? { problemType: query.problemType } : {}),
      ...(query.assignee === 'me'
        ? { assigneeId: actorId }
        : query.assignee === 'unassigned'
          ? { assigneeId: null }
          : query.assigneeId
            ? { assigneeId: query.assigneeId }
            : {}),
      ...(query.huntId ? { huntId: query.huntId } : {}),
      ...(query.creatureId ? { creatureId: query.creatureId } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.author
        ? {
            author: {
              activeCharacter: {
                name: { contains: query.author, mode: 'insensitive' as const },
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { protocol: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(from || to
        ? {
            [dateField]: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lt: to } : {}),
            },
          }
        : {}),
    };
  }

  private person(user: {
    id: string;
    activeCharacter: { name: string } | null;
  }) {
    return {
      id: user.id,
      name: user.activeCharacter?.name ?? null,
    };
  }
}

export { TicketPriority };
