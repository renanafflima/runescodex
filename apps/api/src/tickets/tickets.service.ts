import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  TicketEvidenceSource,
  TicketImpact,
  TicketOrigin,
  TicketPartyFormat,
  TicketProblemType,
  TicketStatus,
  TicketVocation,
} from '../../generated/prisma/client.js';
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

const HUNT_PROBLEM_TYPES = new Set<TicketProblemType>([
  'XP_PER_HOUR',
  'PROFIT',
  'HUNT_OUTDATED',
  'DIFFICULTY',
]);

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_REVIEW, TicketStatus.REJECTED],
  IN_REVIEW: [TicketStatus.RESOLVED, TicketStatus.REJECTED],
  RESOLVED: [],
  REJECTED: [],
};

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
  ) {}

  async create(userId: string, dto: CreateTicketDto) {
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Description is required');
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

    const ticket = await this.prisma.ticket.create({
      data: {
        authorId: userId,
        status: TicketStatus.OPEN,
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

    return this.serialize(ticket);
  }

  async findAll(userId: string, query: ListTicketsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = {
      ...((await this.isAdmin(userId)) ? {} : { authorId: userId }),
      ...(query.status ? { status: query.status } : {}),
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
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.authorId !== userId && !(await this.isAdmin(userId))) {
      throw new ForbiddenException('You can only view your own tickets');
    }
    return this.serialize(ticket);
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
      select: { id: true, status: true },
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

    return this.serialize(ticket);
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
      evidences: ticket.evidences,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}
