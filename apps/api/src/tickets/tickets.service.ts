import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Prisma,
  TicketEvidenceSource,
  TicketImpact,
  TicketOrigin,
  TicketPartyFormat,
  TicketProblemType,
  TicketStatus,
  TicketVocation,
} from '../../generated/prisma/client.js';
import { createTicketProtocol } from '../admin/insights/admin-text';
import { AdminAuditService } from '../audit/admin-audit.service';
import { publicHttpsUrl } from '../common/https-url';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import {
  TicketStorageNotConfiguredError,
  type TicketStorage,
} from './storage/ticket-storage';
import {
  declaredTicketImageMime,
  detectTicketImageMime,
} from './ticket-evidence.bytes';
import {
  buildEvidenceStorageKey,
  filenameForTicketImage,
  MAX_TICKET_EVIDENCES,
  TICKET_EVIDENCE_MAX_BYTES,
  TICKET_STORAGE,
  type TicketImageMime,
} from './tickets.constants';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { ACTIVE_TICKET_STATUSES, STATUS_TRANSITIONS } from './ticket-status';

const HUNT_PROBLEM_TYPES = new Set<TicketProblemType>([
  'XP_PER_HOUR',
  'PROFIT',
  'HUNT_OUTDATED',
  'DIFFICULTY',
]);

const TICKET_INCLUDE = {
  author: { select: { id: true } },
  hunt: { select: { id: true, name: true, slug: true } },
  creature: { select: { id: true, name: true, slug: true } },
  vocations: { select: { vocation: true } },
  evidences: {
    select: {
      id: true,
      storageKey: true,
      url: true,
      mimeType: true,
      source: true,
      byteSize: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

type TicketRecord = {
  id: string;
  authorId: string;
  status: TicketStatus;
  problemType: TicketProblemType;
  impact: TicketImpact;
  origin: TicketOrigin;
  description: string;
  playerLevel: number | null;
  partyFormat: TicketPartyFormat | null;
  catalogValue: string | null;
  userValue: string | null;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedAt: Date | null;
  rewardPoints: number | null;
  rewardGrantedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  protocol?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  assigneeId?: string | null;
  firstResponseAt?: Date | null;
  contentAppliedAt?: Date | null;
  messages?: Array<{
    id: string;
    visibility: 'PUBLIC' | 'INTERNAL';
    body: string;
    createdAt: Date;
    author: { id: string; activeCharacter: { name: string } | null };
  }>;
  author: { id: string };
  hunt: { id: string; name: string; slug: string } | null;
  creature: { id: string; name: string; slug: string } | null;
  vocations: Array<{ vocation: TicketVocation }>;
  evidences: Array<{
    id: string;
    storageKey: string;
    url: string | null;
    mimeType: string;
    source: TicketEvidenceSource;
    byteSize: number | null;
    createdAt: Date;
  }>;
};

export type TicketEvidenceUpload = {
  buffer: Buffer;
  mimetype?: string;
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TICKET_STORAGE) private readonly storage: TicketStorage,
    @Inject(TICKET_EVIDENCE_MAX_BYTES)
    private readonly maxEvidenceBytes: number,
    @Optional() private readonly audit?: AdminAuditService,
  ) {}

  async create(userId: string, dto: CreateTicketDto) {
    const body = dto.description.trim();
    const subject = dto.subject?.trim();
    if (!body) {
      throw new BadRequestException('Description is required');
    }
    if (subject && /[\r\n]/.test(subject)) {
      throw new BadRequestException('Subject must be a single line');
    }
    const description = subject ? `${subject}\n\n${body}` : body;
    if (description.length > 5000) {
      throw new BadRequestException('Description is too long');
    }

    const huntContext = this.huntContext(dto);
    this.assertContext(dto, huntContext);

    if (dto.huntId) {
      const hunt = await this.prisma.hunt.findUnique({
        where: { id: dto.huntId },
        select: { id: true },
      });
      if (!hunt) {
        throw new BadRequestException('Hunt not found');
      }
    }

    if (dto.creatureId) {
      const creature = await this.prisma.creature.findUnique({
        where: { id: dto.creatureId },
        select: { id: true },
      });
      if (!creature) {
        throw new BadRequestException('Creature not found');
      }
    }

    const evidences = (dto.evidences ?? []).map((evidence) => {
      const url = evidence.url ? publicHttpsUrl(evidence.url) : null;
      if (evidence.url && !url) {
        throw new BadRequestException('Evidence URL must be https');
      }
      return {
        storageKey: evidence.storageKey.trim(),
        url,
        mimeType: evidence.mimeType,
        source: evidence.source,
        byteSize: evidence.byteSize ?? null,
      };
    });

    const ticket = await this.insertTicket({
      data: {
        protocol: createTicketProtocol(),
        authorId: userId,
        status: TicketStatus.OPEN,
        priority: 'NORMAL',
        problemType: dto.problemType,
        impact: dto.impact,
        origin: dto.origin,
        description,
        huntId: dto.huntId ?? null,
        creatureId: dto.creatureId ?? null,
        playerLevel: huntContext ? (dto.playerLevel ?? null) : null,
        partyFormat: huntContext ? (dto.partyFormat ?? null) : null,
        catalogValue: huntContext ? this.optionalText(dto.catalogValue) : null,
        userValue: huntContext ? this.optionalText(dto.userValue) : null,
        ...(huntContext
          ? {
              vocations: {
                create: (dto.vocations ?? []).map((vocation) => ({ vocation })),
              },
            }
          : {}),
        ...(evidences.length > 0 ? { evidences: { create: evidences } } : {}),
      },
      include: TICKET_INCLUDE,
    });

    return this.serialize(ticket as unknown as TicketRecord);
  }

  async findAll(userId: string, query: ListTicketsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const own = query.mine === 'true' || !(await this.isAdmin(userId));
    const where = {
      ...(own
        ? { authorId: userId, referralReward: { is: null } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.problemType ? { problemType: query.problemType } : {}),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return pageResult(
      tickets.map((ticket) => this.serialize(ticket)),
      total,
      page,
      limit,
    );
  }

  async findById(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        ...TICKET_INCLUDE,
        referralReward: { select: { id: true } },
        messages: {
          where: { visibility: 'PUBLIC' },
          select: {
            id: true,
            visibility: true,
            body: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                activeCharacter: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    const admin = await this.isAdmin(userId);
    if (ticket.authorId !== userId && !admin) {
      throw new ForbiddenException('You can only view your own tickets');
    }
    if (ticket.referralReward && !admin) {
      throw new NotFoundException('Ticket not found');
    }
    return this.serialize(ticket);
  }

  async reply(userId: string, ticketId: string, rawBody: string) {
    const body = rawBody.trim();
    if (!body) {
      throw new BadRequestException('Escreva a mensagem.');
    }
    if (body.length > 5000) {
      throw new BadRequestException('A mensagem é longa demais.');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        authorId: true,
        status: true,
        referralReward: { select: { id: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.authorId !== userId) {
      throw new ForbiddenException('You can only reply to your own tickets');
    }
    if (ticket.referralReward) {
      throw new NotFoundException('Ticket not found');
    }
    if (!ACTIVE_TICKET_STATUSES.includes(ticket.status)) {
      throw new BadRequestException('Este chamado não aceita novas mensagens.');
    }

    const since = new Date(Date.now() - 15_000);
    await this.prisma.$transaction(async (tx) => {
      const recent = await tx.ticketMessage.findFirst({
        where: {
          ticketId,
          authorId: userId,
          visibility: 'PUBLIC',
          body,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (recent) return;
      await tx.ticketMessage.create({
        data: {
          ticketId,
          authorId: userId,
          visibility: 'PUBLIC',
          body,
        },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });
    });

    return this.findById(userId, ticketId);
  }

  async addEvidence(
    userId: string,
    ticketId: string,
    input: { file?: TicketEvidenceUpload; source?: string },
  ) {
    if (!input.file || input.file.buffer.length === 0) {
      throw new BadRequestException('File is required');
    }
    if (input.file.buffer.length > this.maxEvidenceBytes) {
      throw new PayloadTooLargeException('File is too large');
    }

    const detected = detectTicketImageMime(input.file.buffer);
    const declared = declaredTicketImageMime(input.file.mimetype);
    if (!detected || !declared || detected !== declared) {
      throw new BadRequestException('Invalid image type');
    }

    const source = this.evidenceSource(input.source);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, authorId: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.authorId !== userId) {
      throw new ForbiddenException(
        'You can only add evidence to your own tickets',
      );
    }

    const evidenceCount = await this.prisma.ticketEvidence.count({
      where: { ticketId },
    });
    if (evidenceCount >= MAX_TICKET_EVIDENCES) {
      throw new BadRequestException(
        'This ticket already has the maximum number of evidences',
      );
    }

    const storageKey = buildEvidenceStorageKey(ticketId, detected);
    const stored = await this.storeObject({
      storageKey,
      body: input.file.buffer,
      mimeType: detected,
    });
    const url = await this.storedUrl(stored.url, storageKey);

    try {
      const evidence = await this.prisma.ticketEvidence.create({
        data: {
          ticketId,
          storageKey,
          url,
          mimeType: detected,
          source,
          byteSize: input.file.buffer.length,
        },
      });
      return this.serializeEvidence(evidence);
    } catch (error) {
      await this.removeStoredObject(storageKey);
      throw error;
    }
  }

  async readEvidence(userId: string, ticketId: string, evidenceId: string) {
    const evidence = await this.prisma.ticketEvidence.findFirst({
      where: { id: evidenceId, ticketId },
      select: {
        mimeType: true,
        storageKey: true,
        ticket: { select: { authorId: true } },
      },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }
    if (evidence.ticket.authorId !== userId && !(await this.isAdmin(userId))) {
      throw new ForbiddenException('You can only view your own tickets');
    }

    try {
      const body = await this.storage.get(evidence.storageKey);
      return {
        mimeType: evidence.mimeType,
        filename: filenameForTicketImage(evidence.mimeType),
        body,
      };
    } catch (error) {
      this.storageFailure(error);
    }
  }

  async updateStatus(
    actorId: string,
    ticketId: string,
    dto: UpdateTicketStatusDto,
  ) {
    if (!(await this.isAdmin(actorId))) {
      throw new ForbiddenException('Admin access required');
    }

    const current = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, updatedAt: true },
    });
    if (!current) {
      throw new NotFoundException('Ticket not found');
    }

    const allowed = STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Invalid status transition');
    }

    const terminal =
      dto.status === TicketStatus.RESOLVED ||
      dto.status === TicketStatus.REJECTED;
    const resolutionNote = dto.resolutionNote?.trim();
    if (terminal && !resolutionNote) {
      throw new BadRequestException('Resolution note is required');
    }
    this.assertCurrentUpdate(current.updatedAt, dto.expectedUpdatedAt);

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        ...(resolutionNote ? { resolutionNote } : {}),
        ...(terminal
          ? { resolvedByUserId: actorId, resolvedAt: new Date() }
          : {}),
      },
      include: TICKET_INCLUDE,
    });
    await this.audit?.record({
      actorUserId: actorId,
      action: 'ticket.status',
      entityType: 'ticket',
      entityId: ticketId,
      summary: `Status ${current.status} → ${dto.status}`,
      metadata: { from: current.status, to: dto.status },
    });

    return this.serialize(ticket);
  }

  async reopen(actorId: string, ticketId: string, reason: string) {
    if (!(await this.isAdmin(actorId))) {
      throw new ForbiddenException('Admin access required');
    }
    const note = reason.trim();
    if (note.length < 3) {
      throw new BadRequestException('Reopen reason is required');
    }
    const current = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('Ticket not found');
    }
    if (
      current.status !== TicketStatus.RESOLVED &&
      current.status !== TicketStatus.REJECTED
    ) {
      throw new BadRequestException('Only closed tickets can be reopened');
    }

    const moved = await this.prisma.ticket.updateMany({
      where: {
        id: ticketId,
        status: { in: [TicketStatus.RESOLVED, TicketStatus.REJECTED] },
      },
      data: {
        status: TicketStatus.OPEN,
        resolutionNote: note,
        resolvedAt: null,
        resolvedByUserId: null,
      },
    });
    if (moved.count !== 1) {
      throw new ConflictException('Ticket changed while it was being reopened');
    }
    await this.audit?.record({
      actorUserId: actorId,
      action: 'ticket.reopen',
      entityType: 'ticket',
      entityId: ticketId,
      summary: `Reaberto a partir de ${current.status}`,
      metadata: { from: current.status, to: TicketStatus.OPEN },
    });
    return this.findById(actorId, ticketId);
  }

  private huntContext(dto: CreateTicketDto) {
    return (
      dto.playerLevel !== undefined ||
      dto.partyFormat !== undefined ||
      (dto.vocations?.length ?? 0) > 0 ||
      dto.catalogValue !== undefined ||
      dto.userValue !== undefined
    );
  }

  private assertContext(dto: CreateTicketDto, huntContext: boolean) {
    if (HUNT_PROBLEM_TYPES.has(dto.problemType) && !dto.huntId) {
      throw new BadRequestException('This problem type requires a hunt');
    }
    if (dto.problemType === 'BESTIARY' && !dto.creatureId) {
      throw new BadRequestException('Bestiary tickets require a creature');
    }
    if (dto.origin === 'HUNT' && !dto.huntId) {
      throw new BadRequestException('Hunt origin requires a hunt');
    }
    if (dto.origin === 'BESTIARY' && !dto.creatureId) {
      throw new BadRequestException('Bestiary origin requires a creature');
    }
    if (huntContext && !dto.huntId) {
      throw new BadRequestException('Hunt details require a hunt');
    }
  }

  private async storeObject(object: {
    storageKey: string;
    body: Buffer;
    mimeType: TicketImageMime;
  }) {
    try {
      return await this.storage.put(object);
    } catch (error) {
      this.storageFailure(error);
    }
  }

  private evidenceSource(value: string | undefined): TicketEvidenceSource {
    const source = value?.trim();
    if (
      source === TicketEvidenceSource.CAMERA ||
      source === TicketEvidenceSource.DEVICE
    ) {
      return source;
    }
    throw new BadRequestException('Evidence source must be CAMERA or DEVICE');
  }

  private async storedUrl(url: string | null, storageKey: string) {
    if (!url) {
      return null;
    }
    const safe = publicHttpsUrl(url);
    if (!safe) {
      await this.removeStoredObject(storageKey);
      throw new BadGatewayException('Evidence storage failed');
    }
    return safe;
  }

  private async removeStoredObject(storageKey: string) {
    try {
      await this.storage.delete(storageKey);
    } catch {
      this.logger.error('Failed to remove orphan evidence object');
    }
  }

  private storageFailure(error: unknown): never {
    if (error instanceof TicketStorageNotConfiguredError) {
      throw new ServiceUnavailableException(
        'Evidence storage is not configured',
      );
    }
    throw new BadGatewayException('Evidence storage failed');
  }

  private serializeEvidence(evidence: {
    id: string;
    ticketId: string;
    storageKey: string;
    url: string | null;
    mimeType: string;
    source: TicketEvidenceSource;
    byteSize: number | null;
    createdAt: Date;
  }) {
    return {
      id: evidence.id,
      ticketId: evidence.ticketId,
      storageKey: evidence.storageKey,
      url: evidence.url,
      mimeType: evidence.mimeType,
      source: evidence.source,
      byteSize: evidence.byteSize,
      createdAt: evidence.createdAt,
    };
  }

  private assertCurrentUpdate(updatedAt: Date, expected?: string) {
    if (!expected) return;
    const seen = new Date(expected);
    if (
      Number.isNaN(seen.getTime()) ||
      seen.getTime() !== updatedAt.getTime()
    ) {
      throw new ConflictException('Ticket was updated by someone else');
    }
  }

  private async insertTicket(args: Prisma.TicketCreateArgs) {
    try {
      return await this.prisma.ticket.create(args);
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }
      return this.prisma.ticket.create({
        ...args,
        data: {
          ...(args.data as Prisma.TicketCreateInput),
          protocol: createTicketProtocol(),
        },
      });
    }
  }

  private optionalText(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async isAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.role === 'ADMIN';
  }

  private serialize(ticket: TicketRecord) {
    return {
      id: ticket.id,
      status: ticket.status,
      problemType: ticket.problemType,
      impact: ticket.impact,
      origin: ticket.origin,
      description: ticket.description,
      authorId: ticket.authorId,
      author: { id: ticket.author.id },
      hunt: ticket.hunt,
      creature: ticket.creature,
      playerLevel: ticket.playerLevel,
      partyFormat: ticket.partyFormat,
      vocations: ticket.vocations.map((row) => row.vocation),
      catalogValue: ticket.catalogValue,
      userValue: ticket.userValue,
      resolutionNote: ticket.resolutionNote,
      resolvedByUserId: ticket.resolvedByUserId,
      resolvedAt: ticket.resolvedAt,
      rewardPoints: ticket.rewardPoints,
      rewardGrantedAt: ticket.rewardGrantedAt,
      protocol: ticket.protocol ?? null,
      priority: ticket.priority ?? 'NORMAL',
      assigneeId: ticket.assigneeId ?? null,
      firstResponseAt: ticket.firstResponseAt ?? null,
      contentAppliedAt: ticket.contentAppliedAt ?? null,
      messages: (ticket.messages ?? [])
        .filter((message) => message.visibility === 'PUBLIC')
        .map((message) => ({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          author: {
            id: message.author.id,
            name: message.author.activeCharacter?.name ?? null,
          },
        })),
      evidences: ticket.evidences,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}
