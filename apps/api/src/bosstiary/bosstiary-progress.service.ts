import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BosstiaryActivityKind,
  BosstiaryVisibility,
  HuntSessionParticipantStatus,
  PartyMemberStatus,
  PartyStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import { ListSharedActivitiesQueryDto } from './dto/party.dto';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProgressActivityDto,
  ListProgressActivitiesQueryDto,
  ListProgressChecklistQueryDto,
  UpdateProgressActivityDto,
} from './dto/create-progress-activity.dto';

const ACTIVITY_INCLUDE = {
  boss: { select: { id: true, slug: true, name: true, officialCategory: true } },
  rotation: { select: { id: true, title: true, status: true } },
} satisfies Prisma.BosstiaryProgressActivityInclude;

@Injectable()
export class BosstiaryProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [defeatedDistinct, drops, activities, checklistTotal, checklistDone] =
      await Promise.all([
        this.prisma.bosstiaryProgressActivity.findMany({
          where: { userId, kind: BosstiaryActivityKind.BOSS_KILL },
          distinct: ['bossName'],
          select: { bossName: true },
        }),
        this.prisma.bosstiaryProgressActivity.count({
          where: { userId, kind: BosstiaryActivityKind.DROP },
        }),
        this.prisma.bosstiaryProgressActivity.count({ where: { userId } }),
        this.prisma.bosstiaryBoss.count({ where: { isActive: true } }),
        this.prisma.bosstiaryBossChecklist.count({
          where: { userId, defeated: true },
        }),
      ]);
    return {
      bossesDefeated: defeatedDistinct.length,
      dropsRegistered: drops,
      activitiesRegistered: activities,
      bossesTracked: checklistDone,
      bossesCataloged: checklistTotal,
    };
  }

  async listActivities(userId: string, query: ListProgressActivitiesQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = this.activityWhere(userId, query);
    const [total, rows] = await Promise.all([
      this.prisma.bosstiaryProgressActivity.count({ where }),
      this.prisma.bosstiaryProgressActivity.findMany({
        where,
        include: ACTIVITY_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows.map((row) => this.serializeActivity(row)), total, page, limit);
  }

  async createActivity(userId: string, dto: CreateProgressActivityDto) {
    const resolved = await this.resolveBossAndRotation(userId, dto);
    const group = await this.resolvePartyContext(userId, dto);
    this.assertKindPayload(dto.kind, dto.itemName, dto.itemQuantity);
    const occurredAt = this.parseOccurredAt(dto.occurredAt);
    const visibility = dto.visibility ?? BosstiaryVisibility.PRIVATE;
    if (visibility === BosstiaryVisibility.GROUP && !group.partyId) {
      throw new BadRequestException(
        'Para visibilidade de grupo, associe o registro a uma party ou sessão.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.bosstiaryProgressActivity.create({
        data: {
          userId,
          kind: dto.kind,
          bossId: resolved.bossId,
          bossName: resolved.bossName,
          rotationId: resolved.rotationId,
          rotationTitle: resolved.rotationTitle,
          itemName: dto.kind === BosstiaryActivityKind.DROP ? resolved.itemName : null,
          itemQuantity:
            dto.kind === BosstiaryActivityKind.DROP ? (dto.itemQuantity ?? 1) : null,
          note: dto.note ?? null,
          visibility,
          occurredAt,
          partyId: group.partyId,
          partySessionId: group.huntSessionId,
        },
        include: ACTIVITY_INCLUDE,
      });
      if (dto.kind === BosstiaryActivityKind.BOSS_KILL && resolved.bossId) {
        await this.upsertChecklist(tx, userId, resolved.bossId, true, occurredAt);
      }
      return row;
    });
    return this.serializeActivity(created);
  }

  async listShared(userId: string, partyId: string, query: ListSharedActivitiesQueryDto) {
    await this.requireActivePartyMember(userId, partyId);
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.BosstiaryProgressActivityWhereInput = {
      partyId,
      ...(query.sessionId ? { partySessionId: query.sessionId } : {}),
      OR: [
        { userId },
        { visibility: BosstiaryVisibility.GROUP },
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.bosstiaryProgressActivity.count({ where }),
      this.prisma.bosstiaryProgressActivity.findMany({
        where,
        include: ACTIVITY_INCLUDE,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => this.serializeActivity(row)),
      total,
      page,
      limit,
    );
  }

  async updateActivity(
    userId: string,
    id: string,
    dto: UpdateProgressActivityDto,
  ) {
    const existing = await this.requireOwnedActivity(userId, id);
    const mergedKind = existing.kind;
    const resolved = await this.resolveBossAndRotation(userId, {
      kind: mergedKind,
      bossId: dto.bossId ?? existing.bossId ?? undefined,
      bossName: dto.bossName ?? existing.bossName,
      rotationId:
        dto.rotationId === null ? undefined : (dto.rotationId ?? existing.rotationId ?? undefined),
      itemName: dto.itemName ?? existing.itemName ?? undefined,
      itemQuantity: dto.itemQuantity ?? existing.itemQuantity ?? undefined,
    });
    if (mergedKind === BosstiaryActivityKind.DROP) {
      this.assertKindPayload(
        mergedKind,
        resolved.itemName,
        dto.itemQuantity ?? existing.itemQuantity,
      );
    }
    const occurredAt = dto.occurredAt
      ? this.parseOccurredAt(dto.occurredAt)
      : existing.occurredAt;
    const visibility = dto.visibility ?? existing.visibility;

    const row = await this.prisma.bosstiaryProgressActivity.update({
      where: { id },
      data: {
        bossId: resolved.bossId,
        bossName: resolved.bossName,
        rotationId: dto.rotationId === null ? null : resolved.rotationId,
        rotationTitle: dto.rotationId === null ? null : resolved.rotationTitle,
        itemName:
          mergedKind === BosstiaryActivityKind.DROP
            ? (resolved.itemName ?? existing.itemName)
            : null,
        itemQuantity:
          mergedKind === BosstiaryActivityKind.DROP
            ? (dto.itemQuantity ?? existing.itemQuantity)
            : null,
        note: dto.note === undefined ? existing.note : dto.note,
        visibility,
        occurredAt,
      },
      include: ACTIVITY_INCLUDE,
    });
    return this.serializeActivity(row);
  }

  async removeActivity(userId: string, id: string) {
    await this.requireOwnedActivity(userId, id);
    await this.prisma.bosstiaryProgressActivity.delete({ where: { id } });
    return { id, removed: true };
  }

  async listChecklist(userId: string, query: ListProgressChecklistQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const searchWhere: Prisma.BosstiaryBossWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const filterWhere: Prisma.BosstiaryBossWhereInput =
      query.filter === 'DONE'
        ? { checklistEntries: { some: { userId, defeated: true } } }
        : query.filter === 'PENDING'
          ? { checklistEntries: { none: { userId, defeated: true } } }
          : {};
    const where: Prisma.BosstiaryBossWhereInput = {
      isActive: true,
      ...searchWhere,
      ...filterWhere,
    };
    const [total, bosses] = await Promise.all([
      this.prisma.bosstiaryBoss.count({ where }),
      this.prisma.bosstiaryBoss.findMany({
        where,
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          officialCategory: true,
        },
      }),
    ]);
    const marks = await this.prisma.bosstiaryBossChecklist.findMany({
      where: { userId, bossId: { in: bosses.map((boss) => boss.id) } },
      select: { bossId: true, defeated: true, lastDefeatedAt: true },
    });
    const byBoss = new Map(marks.map((row) => [row.bossId, row]));
    const items = bosses.map((boss) => {
      const mark = byBoss.get(boss.id);
      return {
        bossId: boss.id,
        slug: boss.slug,
        name: boss.name,
        officialCategory: boss.officialCategory,
        defeated: Boolean(mark?.defeated),
        lastDefeatedAt: mark?.lastDefeatedAt?.toISOString() ?? null,
      };
    });
    const images = await this.bossImages(items.map((item) => item.slug));
    return pageResult(
      items.map((item) => ({ ...item, image: images.get(item.slug) ?? null })),
      total,
      page,
      limit,
    );
  }

  async updateChecklist(userId: string, bossId: string, defeated: boolean) {
    const boss = await this.prisma.bosstiaryBoss.findFirst({
      where: { id: bossId, isActive: true },
      select: { id: true, slug: true, name: true, officialCategory: true },
    });
    if (!boss) {
      throw new NotFoundException('Boss não encontrado no Bosstiário revisado.');
    }
    const now = new Date();
    const row = await this.prisma.$transaction((tx) =>
      this.upsertChecklist(tx, userId, boss.id, defeated, defeated ? now : null),
    );
    const images = await this.bossImages([boss.slug]);
    return {
      bossId: boss.id,
      slug: boss.slug,
      name: boss.name,
      officialCategory: boss.officialCategory,
      defeated: row.defeated,
      lastDefeatedAt: row.lastDefeatedAt?.toISOString() ?? null,
      image: images.get(boss.slug) ?? null,
    };
  }

  async myRotations(userId: string) {
    const rows = await this.prisma.communityRotation.findMany({
      where: {
        userId,
        status: { in: ['PUBLISHED', 'DRAFT', 'HIDDEN'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, status: true },
    });
    return rows;
  }

  private activityWhere(
    userId: string,
    query: ListProgressActivitiesQueryDto,
  ): Prisma.BosstiaryProgressActivityWhereInput {
    const and: Prisma.BosstiaryProgressActivityWhereInput[] = [{ userId }];
    if (query.kind) {
      and.push({ kind: query.kind });
    }
    if (query.bossId) {
      and.push({ bossId: query.bossId });
    }
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { bossName: { contains: search, mode: 'insensitive' } },
          { itemName: { contains: search, mode: 'insensitive' } },
          { rotationTitle: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (query.from || query.to) {
      and.push({
        occurredAt: {
          ...(query.from ? { gte: this.parseOccurredAt(query.from) } : {}),
          ...(query.to ? { lte: this.parseOccurredAt(query.to) } : {}),
        },
      });
    }
    return { AND: and };
  }

  private async resolveBossAndRotation(
    userId: string,
    dto: {
      kind: BosstiaryActivityKind;
      bossId?: string | null;
      bossName?: string | null;
      rotationId?: string | null;
      itemName?: string | null;
      itemQuantity?: number | null;
    },
  ) {
    let bossId: string | null = null;
    let bossName = dto.bossName?.trim() ?? '';
    if (dto.bossId) {
      const boss = await this.prisma.bosstiaryBoss.findFirst({
        where: { id: dto.bossId, isActive: true },
        select: { id: true, name: true },
      });
      if (!boss) {
        throw new BadRequestException('Boss do catálogo não encontrado.');
      }
      bossId = boss.id;
      bossName = boss.name;
    }
    if (!bossName) {
      throw new BadRequestException('Informe um boss do catálogo ou um nome.');
    }

    let rotationId: string | null = null;
    let rotationTitle: string | null = null;
    if (dto.rotationId) {
      const rotation = await this.prisma.communityRotation.findFirst({
        where: { id: dto.rotationId },
        select: { id: true, title: true, userId: true, status: true },
      });
      if (!rotation || rotation.status === 'REMOVED') {
        throw new BadRequestException('Rotação não encontrada.');
      }
      if (rotation.userId !== userId) {
        throw new ForbiddenException(
          'Só é possível associar uma rotação da sua conta.',
        );
      }
      rotationId = rotation.id;
      rotationTitle = rotation.title;
    }

    return {
      bossId,
      bossName,
      rotationId,
      rotationTitle,
      itemName: dto.itemName?.trim() || null,
    };
  }

  private async resolvePartyContext(
    userId: string,
    dto: { partyId?: string; huntSessionId?: string },
  ) {
    if (dto.huntSessionId) {
      const participant = await this.prisma.huntSessionParticipant.findUnique({
        where: { sessionId_userId: { sessionId: dto.huntSessionId, userId } },
        include: { session: { select: { id: true, partyId: true, status: true } } },
      });
      if (!participant || participant.status === HuntSessionParticipantStatus.LEFT) {
        throw new ForbiddenException('Você não participa desta sessão.');
      }
      await this.requireActivePartyMember(userId, participant.session.partyId);
      return {
        partyId: participant.session.partyId,
        huntSessionId: participant.session.id,
      };
    }
    if (dto.partyId) {
      await this.requireActivePartyMember(userId, dto.partyId);
      return { partyId: dto.partyId, huntSessionId: null };
    }
    return { partyId: null, huntSessionId: null };
  }

  private async requireActivePartyMember(userId: string, partyId: string) {
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
      select: { status: true, party: { select: { status: true } } },
    });
    if (
      member?.status !== PartyMemberStatus.ACTIVE ||
      member.party.status !== PartyStatus.ACTIVE
    ) {
      throw new ForbiddenException('Você não participa desta party.');
    }
  }

  private async requireOwnedActivity(userId: string, id: string) {
    const row = await this.prisma.bosstiaryProgressActivity.findUnique({
      where: { id },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Registro não encontrado.');
    }
    return row;
  }

  private async upsertChecklist(
    tx: Prisma.TransactionClient,
    userId: string,
    bossId: string,
    defeated: boolean,
    lastDefeatedAt: Date | null,
  ) {
    return tx.bosstiaryBossChecklist.upsert({
      where: { userId_bossId: { userId, bossId } },
      create: {
        userId,
        bossId,
        defeated,
        lastDefeatedAt: defeated ? lastDefeatedAt : null,
      },
      update: {
        defeated,
        lastDefeatedAt: defeated
          ? lastDefeatedAt ?? new Date()
          : undefined,
      },
    });
  }

  private assertKindPayload(
    kind: BosstiaryActivityKind,
    itemName?: string | null,
    itemQuantity?: number | null,
  ) {
    if (kind !== BosstiaryActivityKind.DROP) {
      return;
    }
    if (!itemName?.trim()) {
      throw new BadRequestException('Informe o item do drop.');
    }
    if (!itemQuantity || itemQuantity < 1) {
      throw new BadRequestException('Informe a quantidade do drop.');
    }
  }

  private parseOccurredAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data inválida.');
    }
    return date;
  }

  private async bossImages(slugs: string[]) {
    if (slugs.length === 0) {
      return new Map<string, string | null>();
    }
    const creatures = await this.prisma.creature.findMany({
      where: { slug: { in: slugs }, isActive: true },
      select: { slug: true, image: true },
    });
    return new Map(creatures.map((row) => [row.slug, row.image]));
  }

  private serializeActivity(
    row: Prisma.BosstiaryProgressActivityGetPayload<{
      include: typeof ACTIVITY_INCLUDE;
    }>,
  ) {
    return {
      id: row.id,
      kind: row.kind,
      bossId: row.bossId,
      bossName: row.boss?.name ?? row.bossName,
      bossSlug: row.boss?.slug ?? null,
      officialCategory: row.boss?.officialCategory ?? null,
      rotationId: row.rotationId,
      rotationTitle: row.rotation?.title ?? row.rotationTitle,
      itemName: row.itemName,
      itemQuantity: row.itemQuantity,
      note: row.note,
      visibility: row.visibility,
      partyId: row.partyId,
      huntSessionId: row.partySessionId,
      occurredAt: row.occurredAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
