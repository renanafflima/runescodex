import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppNotificationKind,
  PartyInvitationStatus,
  PartyMemberRole,
  PartyMemberStatus,
  PartyStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePartyDto,
  InvitePartyMemberDto,
  ListPartyQueryDto,
  UpdatePartyDto,
} from './dto/party.dto';
import { PARTY_EMAIL_RE, PARTY_LIMITS } from './party.constants';
import { PartyNotificationsService } from './party-notifications.service';

const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      activeCharacter: { select: { name: true, vocation: true, level: true } },
    },
  },
} satisfies Prisma.PartyMemberInclude;

@Injectable()
export class PartyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: PartyNotificationsService,
  ) {}

  async create(userId: string, dto: CreatePartyDto) {
    const activeCount = await this.prisma.partyMember.count({
      where: {
        userId,
        status: PartyMemberStatus.ACTIVE,
        party: { status: PartyStatus.ACTIVE },
      },
    });
    if (activeCount >= PARTY_LIMITS.maxActivePartiesPerUser) {
      throw new BadRequestException(
        `Você já participa de ${PARTY_LIMITS.maxActivePartiesPerUser} parties ativas.`,
      );
    }
    const party = await this.prisma.$transaction(async (tx) => {
      const created = await tx.party.create({
        data: {
          name: dto.name.trim(),
          description: dto.description ?? null,
          isPrivate: dto.isPrivate ?? true,
          createdById: userId,
          members: {
            create: {
              userId,
              role: PartyMemberRole.LEADER,
              status: PartyMemberStatus.ACTIVE,
            },
          },
        },
      });
      return created;
    });
    return this.get(userId, party.id);
  }

  async listMine(userId: string, query: ListPartyQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.PartyWhereInput = {
      members: { some: { userId, status: PartyMemberStatus.ACTIVE } },
    };
    const [total, rows] = await Promise.all([
      this.prisma.party.count({ where }),
      this.prisma.party.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: {
          members: { where: { status: PartyMemberStatus.ACTIVE }, include: MEMBER_INCLUDE },
          _count: { select: { members: true, invitations: true } },
        },
      }),
    ]);
    return pageResult(
      rows.map((row) => this.serializeParty(row, userId)),
      total,
      page,
      limit,
    );
  }

  async get(userId: string, id: string) {
    const party = await this.requireVisibleParty(userId, id);
    return this.serializeParty(party, userId);
  }

  async update(userId: string, id: string, dto: UpdatePartyDto) {
    await this.requireLeader(userId, id);
    const party = await this.prisma.party.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
      },
    });
    return this.get(userId, party.id);
  }

  async archive(userId: string, id: string) {
    await this.requireLeader(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.party.update({
        where: { id },
        data: { status: PartyStatus.ARCHIVED, archivedAt: new Date() },
      });
      await tx.partyInvitation.updateMany({
        where: { partyId: id, status: PartyInvitationStatus.PENDING },
        data: { status: PartyInvitationStatus.CANCELLED, respondedAt: new Date() },
      });
    });
    return this.get(userId, id);
  }

  async invite(userId: string, partyId: string, dto: InvitePartyMemberDto) {
    const member = await this.requireOfficer(userId, partyId);
    const party = member.party;
    const email = this.normalizeEmail(dto.email);
    if (email.length > 120 || !PARTY_EMAIL_RE.test(email)) {
      throw new BadRequestException('Informe um e-mail válido.');
    }
    await this.expirePending(partyId);
    const inviter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (inviter && this.normalizeEmail(inviter.email) === email) {
      throw new BadRequestException('Você já faz parte desta party.');
    }
    const invitee = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (invitee) {
      const member = await this.prisma.partyMember.findUnique({
        where: { partyId_userId: { partyId, userId: invitee.id } },
      });
      if (member?.status === PartyMemberStatus.ACTIVE) {
        throw new ConflictException('Este jogador já faz parte da party.');
      }
    }
    const pending = await this.prisma.partyInvitation.findFirst({
      where: {
        partyId,
        emailNormalized: email,
        status: PartyInvitationStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException('Já existe um convite pendente para este e-mail.');
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await this.prisma.partyInvitation.count({
      where: { inviterId: userId, createdAt: { gte: since } },
    });
    if (sentToday >= PARTY_LIMITS.maxPendingInvitesPerDay) {
      throw new BadRequestException('Limite diário de convites atingido.');
    }
    const activeMembers = await this.prisma.partyMember.count({
      where: { partyId, status: PartyMemberStatus.ACTIVE },
    });
    if (activeMembers >= PARTY_LIMITS.maxMembers) {
      throw new BadRequestException(
        `A party já atingiu o limite de ${PARTY_LIMITS.maxMembers} integrantes.`,
      );
    }
    const invitation = await this.prisma.partyInvitation.create({
      data: {
        partyId,
        inviterId: userId,
        emailNormalized: email,
        inviteeUserId: invitee?.id ?? null,
        expiresAt: new Date(
          Date.now() + PARTY_LIMITS.invitationExpiryDays * 24 * 60 * 60 * 1000,
        ),
        status: PartyInvitationStatus.PENDING,
      },
    });
    if (invitee) {
      await this.notifications.notify({
        userId: invitee.id,
        kind: AppNotificationKind.PARTY_INVITE_RECEIVED,
        title: 'Convite de party',
        body: `Você foi convidado para ${party.name}.`,
        partyId,
      });
    }
    return this.serializeInvitation(invitation, party.name);
  }

  async listReceived(userId: string, email: string, query: ListPartyQueryDto) {
    await this.expireForEmail(this.normalizeEmail(email));
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.PartyInvitationWhereInput = {
      status: PartyInvitationStatus.PENDING,
      OR: [{ inviteeUserId: userId }, { emailNormalized: this.normalizeEmail(email) }],
    };
    const [total, rows] = await Promise.all([
      this.prisma.partyInvitation.count({ where }),
      this.prisma.partyInvitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { party: { select: { id: true, name: true, status: true } } },
      }),
    ]);
    return pageResult(
      rows.map((row) => this.serializeInvitation(row, row.party.name)),
      total,
      page,
      limit,
    );
  }

  async listSent(userId: string, query: ListPartyQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.PartyInvitationWhereInput = { inviterId: userId };
    const [total, rows] = await Promise.all([
      this.prisma.partyInvitation.count({ where }),
      this.prisma.partyInvitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { party: { select: { name: true } } },
      }),
    ]);
    return pageResult(
      rows.map((row) => this.serializeInvitation(row, row.party.name)),
      total,
      page,
      limit,
    );
  }

  async accept(userId: string, email: string, invitationId: string) {
    const invitation = await this.requireOwnPendingInvite(userId, email, invitationId);
    const activeCount = await this.prisma.partyMember.count({
      where: {
        userId,
        status: PartyMemberStatus.ACTIVE,
        party: { status: PartyStatus.ACTIVE },
      },
    });
    if (activeCount >= PARTY_LIMITS.maxActivePartiesPerUser) {
      throw new BadRequestException(
        `Você já participa de ${PARTY_LIMITS.maxActivePartiesPerUser} parties ativas.`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const members = await tx.partyMember.count({
        where: { partyId: invitation.partyId, status: PartyMemberStatus.ACTIVE },
      });
      if (members >= PARTY_LIMITS.maxMembers) {
        throw new BadRequestException(
          `A party já atingiu o limite de ${PARTY_LIMITS.maxMembers} integrantes.`,
        );
      }
      await tx.partyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: PartyInvitationStatus.ACCEPTED,
          respondedAt: new Date(),
          inviteeUserId: userId,
        },
      });
      await tx.partyMember.upsert({
        where: { partyId_userId: { partyId: invitation.partyId, userId } },
        create: {
          partyId: invitation.partyId,
          userId,
          role: PartyMemberRole.MEMBER,
          status: PartyMemberStatus.ACTIVE,
        },
        update: {
          status: PartyMemberStatus.ACTIVE,
          role: PartyMemberRole.MEMBER,
          joinedAt: new Date(),
          leftAt: null,
        },
      });
    });
    const party = await this.prisma.party.findUniqueOrThrow({
      where: { id: invitation.partyId },
      select: { name: true, createdById: true },
    });
    await this.notifications.notify({
      userId: invitation.inviterId,
      kind: AppNotificationKind.PARTY_INVITE_ACCEPTED,
      title: 'Convite aceito',
      body: `Um jogador entrou em ${party.name}.`,
      partyId: invitation.partyId,
    });
    return this.get(userId, invitation.partyId);
  }

  async decline(userId: string, email: string, invitationId: string) {
    const invitation = await this.requireOwnPendingInvite(userId, email, invitationId);
    await this.prisma.partyInvitation.update({
      where: { id: invitation.id },
      data: {
        status: PartyInvitationStatus.DECLINED,
        respondedAt: new Date(),
        inviteeUserId: userId,
      },
    });
    const party = await this.prisma.party.findUnique({
      where: { id: invitation.partyId },
      select: { name: true },
    });
    await this.notifications.notify({
      userId: invitation.inviterId,
      kind: AppNotificationKind.PARTY_INVITE_DECLINED,
      title: 'Convite recusado',
      body: `Um convite para ${party?.name ?? 'a party'} foi recusado.`,
      partyId: invitation.partyId,
    });
    return { id: invitation.id, status: PartyInvitationStatus.DECLINED };
  }

  async cancelInvite(userId: string, partyId: string, invitationId: string) {
    await this.requireOfficer(userId, partyId);
    const updated = await this.prisma.partyInvitation.updateMany({
      where: {
        id: invitationId,
        partyId,
        status: PartyInvitationStatus.PENDING,
      },
      data: { status: PartyInvitationStatus.CANCELLED, respondedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Este convite não pode ser cancelado.');
    }
    return { id: invitationId, status: PartyInvitationStatus.CANCELLED };
  }

  async removeMember(actorId: string, partyId: string, targetUserId: string) {
    const actor = await this.requireOfficer(actorId, partyId);
    if (actorId === targetUserId) {
      throw new BadRequestException('Use a ação de sair da party.');
    }
    const target = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId: targetUserId } },
      include: { user: { select: { email: true } } },
    });
    if (!target || target.status !== PartyMemberStatus.ACTIVE) {
      throw new NotFoundException('Integrante não encontrado.');
    }
    if (target.role === PartyMemberRole.LEADER) {
      throw new ForbiddenException('Não é possível remover o líder.');
    }
    if (actor.role === PartyMemberRole.OFFICER && target.role !== PartyMemberRole.MEMBER) {
      throw new ForbiddenException('Oficiais só podem remover membros.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.partyMember.update({
        where: { id: target.id },
        data: { status: PartyMemberStatus.REMOVED, leftAt: now },
      }),
      this.prisma.partyInvitation.updateMany({
        where: {
          partyId,
          status: PartyInvitationStatus.PENDING,
          OR: [
            { inviteeUserId: targetUserId },
            { emailNormalized: this.normalizeEmail(target.user.email) },
          ],
        },
        data: { status: PartyInvitationStatus.CANCELLED, respondedAt: now },
      }),
    ]);
    await this.notifications.notify({
      userId: targetUserId,
      kind: AppNotificationKind.PARTY_MEMBER_REMOVED,
      title: 'Removido da party',
      body: `Você foi removido de ${actor.party.name}.`,
      partyId,
    });
    return this.get(actorId, partyId);
  }

  async leave(userId: string, partyId: string) {
    const member = await this.requireActiveMember(userId, partyId);
    if (member.role === PartyMemberRole.LEADER) {
      throw new BadRequestException('Transfira a liderança antes de sair.');
    }
    await this.prisma.partyMember.update({
      where: { id: member.id },
      data: { status: PartyMemberStatus.LEFT, leftAt: new Date() },
    });
    return { id: partyId, left: true };
  }

  async transferLeader(userId: string, partyId: string, nextLeaderId: string) {
    await this.requireLeader(userId, partyId);
    if (userId === nextLeaderId) {
      throw new BadRequestException('Você já é o líder.');
    }
    const next = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId: nextLeaderId } },
    });
    if (!next || next.status !== PartyMemberStatus.ACTIVE) {
      throw new NotFoundException('O novo líder precisa ser um integrante ativo.');
    }
    await this.prisma.$transaction([
      this.prisma.partyMember.update({
        where: { partyId_userId: { partyId, userId } },
        data: { role: PartyMemberRole.OFFICER },
      }),
      this.prisma.partyMember.update({
        where: { partyId_userId: { partyId, userId: nextLeaderId } },
        data: { role: PartyMemberRole.LEADER },
      }),
      this.prisma.party.update({
        where: { id: partyId },
        data: { createdById: nextLeaderId },
      }),
    ]);
    return this.get(userId, partyId);
  }

  async attachInvitesForAuthenticatedUser(userId: string, email: string) {
    const normalized = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user || this.normalizeEmail(user.email) !== normalized) {
      return { linked: 0 };
    }
    const now = new Date();
    await this.prisma.partyInvitation.updateMany({
      where: {
        emailNormalized: normalized,
        status: PartyInvitationStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: { status: PartyInvitationStatus.EXPIRED, respondedAt: now },
    });
    const result = await this.prisma.partyInvitation.updateMany({
      where: {
        emailNormalized: normalized,
        status: PartyInvitationStatus.PENDING,
        inviteeUserId: null,
      },
      data: { inviteeUserId: userId },
    });
    return { linked: result.count };
  }

  async requireActiveMember(userId: string, partyId: string) {
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
      include: { party: true },
    });
    if (
      !member ||
      member.status !== PartyMemberStatus.ACTIVE ||
      member.party.status !== PartyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Você não participa desta party.');
    }
    return member;
  }

  async isActiveMember(userId: string, partyId: string) {
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
      select: { status: true, party: { select: { status: true } } },
    });
    return (
      member?.status === PartyMemberStatus.ACTIVE &&
      member.party.status === PartyStatus.ACTIVE
    );
  }

  private async requireVisibleParty(userId: string, id: string) {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        members: { where: { status: PartyMemberStatus.ACTIVE }, include: MEMBER_INCLUDE },
      },
    });
    if (!party) throw new NotFoundException('Party não encontrada.');
    const allowed = party.members.some((member) => member.userId === userId);
    if (!allowed) throw new ForbiddenException('Você não participa desta party.');
    return party;
  }

  private async requireLeader(userId: string, partyId: string) {
    const member = await this.requireActiveMember(userId, partyId);
    if (member.role !== PartyMemberRole.LEADER) {
      throw new ForbiddenException('Apenas o líder pode fazer isso.');
    }
    return member;
  }

  private async requireOfficer(userId: string, partyId: string) {
    const member = await this.requireActiveMember(userId, partyId);
    if (member.role === PartyMemberRole.MEMBER) {
      throw new ForbiddenException('Apenas o líder ou um oficial podem convidar.');
    }
    return member;
  }

  private async requireOwnPendingInvite(userId: string, email: string, id: string) {
    await this.expirePendingById(id);
    const invitation = await this.prisma.partyInvitation.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException('Convite não encontrado.');
    const normalized = this.normalizeEmail(email);
    const owns =
      invitation.inviteeUserId === userId || invitation.emailNormalized === normalized;
    if (!owns) {
      throw new ForbiddenException('Este convite não é seu.');
    }
    if (invitation.status === PartyInvitationStatus.EXPIRED) {
      throw new ConflictException('Este convite expirou.');
    }
    if (invitation.status !== PartyInvitationStatus.PENDING) {
      throw new ConflictException('Este convite já foi respondido.');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.partyInvitation.update({
        where: { id },
        data: { status: PartyInvitationStatus.EXPIRED, respondedAt: new Date() },
      });
      throw new ConflictException('Este convite expirou.');
    }
    const party = await this.prisma.party.findUnique({ where: { id: invitation.partyId } });
    if (!party || party.status !== PartyStatus.ACTIVE) {
      throw new ConflictException('Esta party não está mais ativa.');
    }
    return invitation;
  }

  private async expirePending(partyId: string) {
    await this.prisma.partyInvitation.updateMany({
      where: {
        partyId,
        status: PartyInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: PartyInvitationStatus.EXPIRED, respondedAt: new Date() },
    });
  }

  private async expirePendingById(id: string) {
    await this.prisma.partyInvitation.updateMany({
      where: { id, status: PartyInvitationStatus.PENDING, expiresAt: { lte: new Date() } },
      data: { status: PartyInvitationStatus.EXPIRED, respondedAt: new Date() },
    });
  }

  private async expireForEmail(email: string) {
    await this.prisma.partyInvitation.updateMany({
      where: {
        emailNormalized: email,
        status: PartyInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: PartyInvitationStatus.EXPIRED, respondedAt: new Date() },
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private serializeInvitation(
    row: {
      id: string;
      partyId: string;
      inviterId: string;
      emailNormalized: string;
      inviteeUserId: string | null;
      status: PartyInvitationStatus;
      expiresAt: Date;
      respondedAt: Date | null;
      createdAt: Date;
    },
    partyName: string,
  ) {
    return {
      id: row.id,
      partyId: row.partyId,
      partyName,
      inviterId: row.inviterId,
      email: row.emailNormalized,
      inviteeUserId: row.inviteeUserId,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      awaitingAccount: !row.inviteeUserId,
    };
  }

  private serializeParty(
    party: {
      id: string;
      name: string;
      description: string | null;
      createdById: string;
      status: PartyStatus;
      isPrivate: boolean;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      members: Array<{
        id: string;
        userId: string;
        role: PartyMemberRole;
        status: PartyMemberStatus;
        joinedAt: Date;
        user: {
          id: string;
          email: string;
          activeCharacter: { name: string; vocation: string; level: number } | null;
        };
      }>;
    },
    viewerId: string,
  ) {
    const viewer = party.members.find((member) => member.userId === viewerId);
    return {
      id: party.id,
      name: party.name,
      description: party.description,
      createdById: party.createdById,
      status: party.status,
      isPrivate: party.isPrivate,
      archivedAt: party.archivedAt?.toISOString() ?? null,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
      myRole: viewer?.role ?? null,
      memberCount: party.members.length,
      members: party.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        status: member.status,
        joinedAt: member.joinedAt.toISOString(),
        name: member.user.activeCharacter?.name ?? 'Jogador',
        vocation: member.user.activeCharacter?.vocation ?? null,
        level: member.user.activeCharacter?.level ?? null,
        avatar: (member.user.activeCharacter?.name ?? 'Jogador').slice(0, 1).toUpperCase(),
      })),
      limits: PARTY_LIMITS,
    };
  }
}
