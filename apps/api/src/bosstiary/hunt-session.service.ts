import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppNotificationKind,
  CommunityRotationStatus,
  HuntSessionParticipantStatus,
  HuntSessionStatus,
  PartyMemberStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddSessionParticipantDto,
  CreateHuntSessionDto,
  ListPartyQueryDto,
} from './dto/party.dto';
import { PartyNotificationsService } from './party-notifications.service';
import { PartyService } from './party.service';

const SESSION_INCLUDE = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          activeCharacter: { select: { name: true, vocation: true, level: true } },
        },
      },
    },
  },
  rotation: { select: { id: true, title: true, status: true } },
} satisfies Prisma.HuntSessionInclude;

@Injectable()
export class HuntSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parties: PartyService,
    private readonly notifications: PartyNotificationsService,
  ) {}

  async create(userId: string, partyId: string, dto: CreateHuntSessionDto) {
    const member = await this.parties.requireActiveMember(userId, partyId);
    if (member.role === 'MEMBER') {
      throw new ForbiddenException('Apenas o líder ou um oficial podem criar sessões.');
    }
    const rotation = dto.rotationId
      ? await this.prisma.communityRotation.findUnique({
          where: { id: dto.rotationId },
          select: { id: true, title: true, status: true, userId: true },
        })
      : null;
    if (dto.rotationId && (!rotation || rotation.status === CommunityRotationStatus.REMOVED)) {
      throw new BadRequestException('Rotação não encontrada.');
    }
    const participantIds = new Set(dto.participantIds ?? []);
    participantIds.add(userId);
    const allowed = await this.prisma.partyMember.findMany({
      where: {
        partyId,
        userId: { in: [...participantIds] },
        status: PartyMemberStatus.ACTIVE,
      },
      select: { userId: true },
    });
    const allowedIds = new Set(allowed.map((row) => row.userId));
    for (const id of participantIds) {
      if (!allowedIds.has(id)) {
        throw new BadRequestException('Só integrantes ativos da party podem entrar na sessão.');
      }
    }
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.huntSession.create({
        data: {
          partyId,
          createdById: userId,
          title: dto.title.trim(),
          description: dto.description ?? null,
          rotationId: rotation?.id ?? null,
          rotationTitle: rotation?.title ?? null,
          plannedAt: dto.plannedAt ? new Date(dto.plannedAt) : null,
          status: HuntSessionStatus.PLANNED,
          participants: {
            create: [...participantIds].map((id) => ({
              userId: id,
              status: HuntSessionParticipantStatus.CONFIRMED,
            })),
          },
        },
        include: SESSION_INCLUDE,
      });
      return created;
    });
    const others = [...participantIds].filter((id) => id !== userId);
    await Promise.all(
      others.map((id) =>
        this.notifications.notify({
          userId: id,
          kind: AppNotificationKind.HUNT_SESSION_CREATED,
          title: 'Sessão de hunt criada',
          body: `${session.title} foi marcada na sua party.`,
          partyId,
          sessionId: session.id,
        }),
      ),
    );
    return this.serialize(session);
  }

  async list(userId: string, partyId: string, query: ListPartyQueryDto) {
    await this.parties.requireActiveMember(userId, partyId);
    const { page, limit, skip } = resolvePage(query);
    const where = { partyId };
    const [total, rows] = await Promise.all([
      this.prisma.huntSession.count({ where }),
      this.prisma.huntSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows.map((row) => this.serialize(row)), total, page, limit);
  }

  async get(userId: string, partyId: string, sessionId: string) {
    await this.parties.requireActiveMember(userId, partyId);
    const session = await this.prisma.huntSession.findFirst({
      where: { id: sessionId, partyId },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return this.serialize(session);
  }

  async start(userId: string, partyId: string, sessionId: string) {
    const session = await this.requireLeaderSession(userId, partyId, sessionId);
    if (session.status !== HuntSessionStatus.PLANNED) {
      throw new ConflictException('Só sessões planejadas podem ser iniciadas.');
    }
    const updated = await this.prisma.huntSession.update({
      where: { id: sessionId },
      data: { status: HuntSessionStatus.ACTIVE, startedAt: new Date() },
      include: SESSION_INCLUDE,
    });
    await this.notifyParticipants(updated, userId, AppNotificationKind.HUNT_SESSION_STARTED, 'Sessão iniciada');
    return this.serialize(updated);
  }

  async complete(userId: string, partyId: string, sessionId: string) {
    const session = await this.requireLeaderSession(userId, partyId, sessionId);
    if (session.status !== HuntSessionStatus.ACTIVE && session.status !== HuntSessionStatus.PLANNED) {
      throw new ConflictException('Esta sessão não pode ser finalizada.');
    }
    const updated = await this.prisma.huntSession.update({
      where: { id: sessionId },
      data: { status: HuntSessionStatus.COMPLETED, completedAt: new Date() },
      include: SESSION_INCLUDE,
    });
    await this.notifyParticipants(
      updated,
      userId,
      AppNotificationKind.HUNT_SESSION_COMPLETED,
      'Sessão finalizada',
    );
    return this.serialize(updated);
  }

  async cancel(userId: string, partyId: string, sessionId: string) {
    const session = await this.requireLeaderSession(userId, partyId, sessionId);
    if (session.status === HuntSessionStatus.COMPLETED) {
      throw new ConflictException('Sessão já finalizada.');
    }
    const updated = await this.prisma.huntSession.update({
      where: { id: sessionId },
      data: { status: HuntSessionStatus.CANCELLED, completedAt: new Date() },
      include: SESSION_INCLUDE,
    });
    return this.serialize(updated);
  }

  async addParticipant(
    userId: string,
    partyId: string,
    sessionId: string,
    dto: AddSessionParticipantDto,
  ) {
    await this.requireLeaderSession(userId, partyId, sessionId);
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId: dto.userId } },
    });
    if (!member || member.status !== PartyMemberStatus.ACTIVE) {
      throw new BadRequestException('O jogador precisa ser integrante ativo da party.');
    }
    try {
      await this.prisma.huntSessionParticipant.create({
        data: {
          sessionId,
          userId: dto.userId,
          status: HuntSessionParticipantStatus.CONFIRMED,
        },
      });
    } catch (error) {
      if (this.isUnique(error)) {
        throw new ConflictException('Este jogador já está na sessão.');
      }
      throw error;
    }
    await this.notifications.notify({
      userId: dto.userId,
      kind: AppNotificationKind.HUNT_SESSION_INVITED,
      title: 'Você foi adicionado a uma sessão',
      body: 'Uma hunt da sua party agora inclui você.',
      partyId,
      sessionId,
    });
    return this.get(userId, partyId, sessionId);
  }

  async requireParticipant(userId: string, sessionId: string) {
    const row = await this.prisma.huntSessionParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      include: { session: { select: { id: true, partyId: true, status: true } } },
    });
    if (!row || row.status === HuntSessionParticipantStatus.LEFT) {
      throw new ForbiddenException('Você não participa desta sessão.');
    }
    return row;
  }

  private async requireLeaderSession(userId: string, partyId: string, sessionId: string) {
    const member = await this.parties.requireActiveMember(userId, partyId);
    if (member.role === 'MEMBER') {
      throw new ForbiddenException('Apenas o líder ou um oficial podem gerenciar a sessão.');
    }
    const session = await this.prisma.huntSession.findFirst({
      where: { id: sessionId, partyId },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    return session;
  }

  private async notifyParticipants(
    session: Prisma.HuntSessionGetPayload<{ include: typeof SESSION_INCLUDE }>,
    actorId: string,
    kind: AppNotificationKind,
    title: string,
  ) {
    await Promise.all(
      session.participants
        .filter((row) => row.userId !== actorId)
        .map((row) =>
          this.notifications.notify({
            userId: row.userId,
            kind,
            title,
            body: session.title,
            partyId: session.partyId,
            sessionId: session.id,
          }),
        ),
    );
  }

  private isUnique(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private serialize(row: Prisma.HuntSessionGetPayload<{ include: typeof SESSION_INCLUDE }>) {
    return {
      id: row.id,
      partyId: row.partyId,
      createdById: row.createdById,
      title: row.title,
      description: row.description,
      rotationId: row.rotationId,
      rotationTitle: row.rotation?.title ?? row.rotationTitle,
      rotationRemoved: row.rotationId ? !row.rotation : false,
      plannedAt: row.plannedAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      participants: row.participants.map((item) => ({
        id: item.id,
        userId: item.userId,
        status: item.status,
        name: item.user.activeCharacter?.name ?? 'Jogador',
        vocation: item.user.activeCharacter?.vocation ?? null,
        level: item.user.activeCharacter?.level ?? null,
      })),
    };
  }
}
