import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityRotationStatus,
  Prisma,
  UserRole,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { currentPeriodWindow } from '../rewards/rewards.periods';
import { RewardsService } from '../rewards/rewards.service';
import {
  COMMUNITY_ROTATION_LEVEL_LABELS,
  COMMUNITY_ROTATION_PUBLISHED_EVENT,
  mapDurationFilter,
  mapLevelFilter,
  mapModeFilter,
  PUBLIC_STATUSES,
} from './community-rotation.constants';
import { validateBossStopsInput } from './community-rotation-bosses.validation';
import {
  hashCommunityRotationCreatePayload,
  sanitizeCommunityRotationIdempotencyKey,
} from './community-rotation-publish.idempotency';
import { CommunityRotationBossInputDto } from './dto/community-rotation-boss-input.dto';
import { CreateCommunityRotationDto } from './dto/create-community-rotation.dto';
import { CreateCommunityRotationTestDto } from './dto/create-community-rotation-test.dto';
import { ListCommunityRotationsQueryDto } from './dto/list-community-rotations-query.dto';
import { UpdateCommunityRotationDto } from './dto/update-community-rotation.dto';

const ROTATION_INCLUDE = {
  user: {
    select: {
      id: true,
      activeCharacter: { select: { name: true, vocation: true, level: true } },
    },
  },
  bosses: {
    orderBy: { position: 'asc' as const },
    include: {
      boss: { select: { id: true, slug: true, name: true } },
    },
  },
  _count: {
    select: {
      likes: true,
      favorites: true,
      comments: true,
    },
  },
} satisfies Prisma.CommunityRotationInclude;

type RotationRow = Prisma.CommunityRotationGetPayload<{
  include: typeof ROTATION_INCLUDE;
}>;

type EngagementState = {
  liked: Set<string>;
  favorited: Set<string>;
  authorTested: Set<string>;
  testedByMe: Set<string>;
};

@Injectable()
export class CommunityRotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  async list(query: ListCommunityRotationsQueryDto, userId: string) {
    const { page, limit, skip } = resolvePage(query);
    const featuredSet = new Set(await this.weeklyFeaturedRotationIds(3));
    const where = this.listWhere(query);

    const sort = query.sort ?? 'RECENT';
    const orderBy = this.listOrderBy(sort);

    const [total, rows] = await Promise.all([
      this.prisma.communityRotation.count({ where }),
      this.prisma.communityRotation.findMany({
        where,
        include: ROTATION_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const ids = rows.map((row) => row.id);
    const engagement = await this.rotationEngagement(ids, userId);
    const images = await this.bossImages(rows);

    const rankingPreview = query.rankingPreview
      ? await this.weeklyRanking(query.rankingPreview)
      : undefined;

    return {
      ...pageResult(
        rows.map((row) =>
          this.serializeCard(row, engagement, images, featuredSet.has(row.id)),
        ),
        total,
        page,
        limit,
      ),
      rankingPreview,
      levelLabels: COMMUNITY_ROTATION_LEVEL_LABELS,
    };
  }

  async weeklyFeaturedRotationIds(limit = 3) {
    const top = await this.weeklyLikeCounts(limit);
    return top.map((row) => row.rotationId);
  }

  async weeklyRanking(limit: number) {
    const top = await this.weeklyLikeCounts(limit);
    if (top.length === 0) {
      return [];
    }
    const ids = top.map((row) => row.rotationId);
    const weeklyLikes = new Map(
      top.map((row) => [row.rotationId, row._count._all]),
    );
    const rows = await this.prisma.communityRotation.findMany({
      where: { id: { in: ids }, status: CommunityRotationStatus.PUBLISHED },
      include: ROTATION_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const featuredSet = new Set(ids.slice(0, 3));
    const images = await this.bossImages(rows);

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is RotationRow => Boolean(row))
      .map((row) => ({
        ...this.serializeCard(
          row,
          emptyEngagement(),
          images,
          featuredSet.has(row.id),
        ),
        weeklyLikes: weeklyLikes.get(row.id) ?? 0,
      }));
  }

  async findOne(id: string, userId: string) {
    const row = await this.prisma.communityRotation.findUnique({
      where: { id },
      include: ROTATION_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Rotação não encontrada.');
    }
    if (
      !PUBLIC_STATUSES.includes(row.status) &&
      row.userId !== userId &&
      !(await this.isAdmin(userId))
    ) {
      throw new NotFoundException('Rotação não encontrada.');
    }
    const featuredSet = new Set(await this.weeklyFeaturedRotationIds(3));
    const engagement = await this.rotationEngagement([row.id], userId);
    const images = await this.bossImages([row]);
    return this.serializeCard(row, engagement, images, featuredSet.has(row.id));
  }

  async create(
    userId: string,
    dto: CreateCommunityRotationDto,
    idempotencyKeyRaw?: string,
  ) {
    const bosses = await this.validateBosses(dto.bosses);
    const idempotencyKey =
      sanitizeCommunityRotationIdempotencyKey(idempotencyKeyRaw);
    const requestHash = hashCommunityRotationCreatePayload(dto);

    if (idempotencyKey) {
      const cached = await this.findIdempotentCreate(
        userId,
        idempotencyKey,
        requestHash,
      );
      if (cached) {
        return cached;
      }
    }

    const status = CommunityRotationStatus.PUBLISHED;

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) {
          await this.lockPublishIdempotency(tx, userId, idempotencyKey);
          const prior = await tx.communityRotationPublishIdempotency.findUnique(
            {
              where: {
                userId_idempotencyKey: { userId, idempotencyKey },
              },
              select: { requestHash: true, rotationId: true },
            },
          );
          if (prior) {
            if (prior.requestHash !== requestHash) {
              throw new ConflictException(
                'Idempotency-Key já foi usada com outro payload.',
              );
            }
            return tx.communityRotation.findUniqueOrThrow({
              where: { id: prior.rotationId },
              include: ROTATION_INCLUDE,
            });
          }
        }

        const created = await tx.communityRotation.create({
          data: {
            userId,
            title: dto.title.trim(),
            description: dto.description ?? null,
            accessRequirements: dto.accessRequirements ?? null,
            additionalInfo: dto.additionalInfo ?? null,
            recommendedLevel: dto.recommendedLevel,
            huntMode: dto.huntMode,
            plannedDurationMinutes: dto.plannedDurationMinutes,
            vocation: dto.vocation ?? null,
            characterLevel: dto.characterLevel ?? null,
            partySize: dto.partySize ?? null,
            observedTotalMinutes: dto.observedTotalMinutes ?? null,
            combatMinutes: dto.combatMinutes ?? null,
            travelMinutes: dto.travelMinutes ?? null,
            status,
            bosses: { create: bosses },
          },
          include: ROTATION_INCLUDE,
        });

        if (status === CommunityRotationStatus.PUBLISHED) {
          await this.recordPublishReward(tx, userId, created.id);
        }

        if (idempotencyKey) {
          await tx.communityRotationPublishIdempotency.create({
            data: {
              userId,
              idempotencyKey,
              requestHash,
              rotationId: created.id,
            },
          });
        }

        return created;
      });

      return this.cardFromRow(row, userId);
    } catch (error) {
      if (idempotencyKey && isUniqueViolation(error)) {
        const cached = await this.findIdempotentCreate(
          userId,
          idempotencyKey,
          requestHash,
        );
        if (cached) {
          return cached;
        }
      }
      throw error;
    }
  }

  async update(id: string, userId: string, dto: UpdateCommunityRotationDto) {
    const existing = await this.requireAuthorOrAdmin(id, userId);
    const bosses =
      dto.bosses === undefined
        ? undefined
        : await this.validateBosses(dto.bosses);

    const row = await this.prisma.$transaction(async (tx) => {
      if (bosses !== undefined) {
        await tx.communityRotationBoss.deleteMany({ where: { rotationId: id } });
      }
      return tx.communityRotation.update({
        where: { id: existing.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description ?? null }
            : {}),
          ...(dto.accessRequirements !== undefined
            ? { accessRequirements: dto.accessRequirements ?? null }
            : {}),
          ...(dto.additionalInfo !== undefined
            ? { additionalInfo: dto.additionalInfo ?? null }
            : {}),
          ...(dto.recommendedLevel !== undefined
            ? { recommendedLevel: dto.recommendedLevel }
            : {}),
          ...(dto.huntMode !== undefined ? { huntMode: dto.huntMode } : {}),
          ...(dto.plannedDurationMinutes !== undefined
            ? { plannedDurationMinutes: dto.plannedDurationMinutes }
            : {}),
          ...(dto.vocation !== undefined
            ? { vocation: dto.vocation ?? null }
            : {}),
          ...(dto.characterLevel !== undefined
            ? { characterLevel: dto.characterLevel ?? null }
            : {}),
          ...(dto.partySize !== undefined
            ? { partySize: dto.partySize ?? null }
            : {}),
          ...(dto.observedTotalMinutes !== undefined
            ? { observedTotalMinutes: dto.observedTotalMinutes ?? null }
            : {}),
          ...(dto.combatMinutes !== undefined
            ? { combatMinutes: dto.combatMinutes ?? null }
            : {}),
          ...(dto.travelMinutes !== undefined
            ? { travelMinutes: dto.travelMinutes ?? null }
            : {}),
          ...(bosses !== undefined ? { bosses: { create: bosses } } : {}),
        },
        include: ROTATION_INCLUDE,
      });
    });

    const engagement = await this.rotationEngagement([row.id], userId);
    const images = await this.bossImages([row]);
    const featuredSet = new Set(await this.weeklyFeaturedRotationIds(3));
    return this.serializeCard(row, engagement, images, featuredSet.has(row.id));
  }

  async remove(id: string, userId: string) {
    const existing = await this.requireAuthorOrAdmin(id, userId);
    if (existing.status === CommunityRotationStatus.REMOVED) {
      return { id, removed: true };
    }
    await this.prisma.communityRotation.update({
      where: { id },
      data: { status: CommunityRotationStatus.REMOVED },
    });
    return { id, removed: true };
  }

  async like(id: string, userId: string) {
    await this.requirePublished(id);
    try {
      await this.prisma.communityRotationLike.create({
        data: { rotationId: id, userId },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Você já curtiu esta rotação.');
      }
      throw error;
    }
    return this.socialState(id, userId);
  }

  async unlike(id: string, userId: string) {
    await this.requirePublished(id);
    await this.prisma.communityRotationLike.deleteMany({
      where: { rotationId: id, userId },
    });
    return this.socialState(id, userId);
  }

  async favorite(id: string, userId: string) {
    await this.requirePublished(id);
    try {
      await this.prisma.communityRotationFavorite.create({
        data: { rotationId: id, userId },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
    return this.socialState(id, userId);
  }

  async unfavorite(id: string, userId: string) {
    await this.requirePublished(id);
    await this.prisma.communityRotationFavorite.deleteMany({
      where: { rotationId: id, userId },
    });
    return this.socialState(id, userId);
  }

  async createTest(
    id: string,
    userId: string,
    dto: CreateCommunityRotationTestDto,
  ) {
    const rotation = await this.requirePublished(id);
    const already = await this.prisma.communityRotationTest.findFirst({
      where: { rotationId: rotation.id, userId },
      select: { id: true },
    });
    if (already) {
      throw new ConflictException('Você já avaliou esta rotação.');
    }
    try {
      const created = await this.prisma.communityRotationTest.create({
        data: {
          rotationId: rotation.id,
          userId,
          vocation: dto.vocation ?? null,
          characterLevel: dto.characterLevel ?? null,
          partySize: dto.partySize ?? null,
          combatMinutes: dto.combatMinutes ?? null,
          travelMinutes: dto.travelMinutes ?? null,
          totalMinutes: dto.totalMinutes ?? null,
          notes: dto.notes ?? null,
        },
      });
      return this.serializeTest(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Você já avaliou esta rotação.');
      }
      throw error;
    }
  }

  async listTests(id: string, query: PageQueryDto) {
    await this.requirePublished(id);
    const { page, limit, skip } = resolvePage(query);
    const where = { rotationId: id };
    const [total, rows] = await Promise.all([
      this.prisma.communityRotationTest.count({ where }),
      this.prisma.communityRotationTest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows.map((row) => this.serializeTest(row)), total, page, limit);
  }

  private listWhere(
    query: ListCommunityRotationsQueryDto,
  ): Prisma.CommunityRotationWhereInput {
    const and: Prisma.CommunityRotationWhereInput[] = [
      { status: { in: PUBLIC_STATUSES } },
    ];
    const recommendedLevel = mapLevelFilter(query.level);
    if (recommendedLevel) {
      and.push({ recommendedLevel });
    }
    const huntMode = mapModeFilter(query.mode);
    if (huntMode) {
      and.push({ huntMode });
    }
    const plannedDurationMinutes = mapDurationFilter(query.duration);
    if (plannedDurationMinutes) {
      and.push({ plannedDurationMinutes });
    }
    const search = query.search?.trim();
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          {
            user: {
              activeCharacter: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            bosses: {
              some: {
                OR: [
                  { bossName: { contains: search, mode: 'insensitive' } },
                  { boss: { name: { contains: search, mode: 'insensitive' } } },
                ],
              },
            },
          },
        ],
      });
    }
    return { AND: and };
  }

  private listOrderBy(
    sort: NonNullable<ListCommunityRotationsQueryDto['sort']>,
  ): Prisma.CommunityRotationOrderByWithRelationInput[] {
    if (sort === 'LIKES') {
      return [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }];
    }
    if (sort === 'COMMENTS') {
      return [
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ];
    }
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  private async validateBosses(bosses: CommunityRotationBossInputDto[]) {
    const bossIds = bosses
      .map((item) => item.bossId)
      .filter((value): value is string => Boolean(value));
    const known =
      bossIds.length === 0
        ? []
        : await this.prisma.bosstiaryBoss.findMany({
            where: { id: { in: bossIds } },
            select: { id: true },
          });
    const knownIds = new Set(known.map((row) => row.id));
    return validateBossStopsInput(bosses, knownIds);
  }

  private async weeklyLikeCounts(limit: number) {
    const { periodStart, periodEnd } = currentPeriodWindow('WEEKLY');
    const grouped = await this.prisma.communityRotationLike.groupBy({
      by: ['rotationId'],
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        rotation: { status: CommunityRotationStatus.PUBLISHED },
      },
      _count: { _all: true },
    });
    grouped.sort((a, b) => {
      const diff = b._count._all - a._count._all;
      if (diff !== 0) {
        return diff;
      }
      return a.rotationId.localeCompare(b.rotationId);
    });
    return grouped.slice(0, limit);
  }

  private async findIdempotentCreate(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const row = await this.prisma.communityRotationPublishIdempotency.findUnique(
      {
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: { rotation: { include: ROTATION_INCLUDE } },
      },
    );
    if (!row) {
      return null;
    }
    if (row.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency-Key já foi usada com outro payload.',
      );
    }
    return this.cardFromRow(row.rotation, userId);
  }

  private async cardFromRow(row: RotationRow, userId: string) {
    const featuredSet = new Set(await this.weeklyFeaturedRotationIds(3));
    const engagement = await this.rotationEngagement([row.id], userId);
    const images = await this.bossImages([row]);
    return this.serializeCard(
      row,
      engagement,
      images,
      featuredSet.has(row.id),
    );
  }

  private async lockPublishIdempotency(
    tx: Prisma.TransactionClient,
    userId: string,
    idempotencyKey: string,
  ) {
    const lockKey = `${userId}:${idempotencyKey}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  private async requirePublished(id: string) {
    const rotation = await this.prisma.communityRotation.findFirst({
      where: { id, status: CommunityRotationStatus.PUBLISHED },
      select: { id: true, userId: true },
    });
    if (!rotation) {
      throw new NotFoundException('Rotação não encontrada.');
    }
    return rotation;
  }

  private async requireAuthorOrAdmin(id: string, userId: string) {
    const rotation = await this.prisma.communityRotation.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!rotation) {
      throw new NotFoundException('Rotação não encontrada.');
    }
    if (rotation.userId !== userId && !(await this.isAdmin(userId))) {
      throw new ForbiddenException('Você não pode alterar esta rotação.');
    }
    return rotation;
  }

  private async isAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === UserRole.ADMIN;
  }

  private async rotationEngagement(
    rotationIds: string[],
    userId: string,
  ): Promise<EngagementState> {
    if (rotationIds.length === 0) {
      return emptyEngagement();
    }
    const [likes, favorites, rotations] = await Promise.all([
      this.prisma.communityRotationLike.findMany({
        where: { userId, rotationId: { in: rotationIds } },
        select: { rotationId: true },
      }),
      this.prisma.communityRotationFavorite.findMany({
        where: { userId, rotationId: { in: rotationIds } },
        select: { rotationId: true },
      }),
      this.prisma.communityRotation.findMany({
        where: { id: { in: rotationIds } },
        select: { id: true, userId: true },
      }),
    ]);

    const authorTested = new Set<string>();
    const authorByRotation = new Map(
      rotations.map((row) => [row.id, row.userId]),
    );
    const authorTestsRows = await this.prisma.communityRotationTest.findMany({
      where: { rotationId: { in: rotationIds } },
      select: { rotationId: true, userId: true },
    });
    const testedByMe = new Set<string>();
    for (const test of authorTestsRows) {
      if (authorByRotation.get(test.rotationId) === test.userId) {
        authorTested.add(test.rotationId);
      }
      if (test.userId === userId) {
        testedByMe.add(test.rotationId);
      }
    }

    return {
      liked: new Set(likes.map((row) => row.rotationId)),
      favorited: new Set(favorites.map((row) => row.rotationId)),
      authorTested,
      testedByMe,
    };
  }

  private async socialState(rotationId: string, userId: string) {
    const engagement = await this.rotationEngagement([rotationId], userId);
    const counts = await this.prisma.communityRotation.findUnique({
      where: { id: rotationId },
      select: {
        _count: { select: { likes: true, favorites: true } },
      },
    });
    return {
      rotationId,
      likesCount: counts?._count.likes ?? 0,
      favoritesCount: counts?._count.favorites ?? 0,
      likedByMe: engagement.liked.has(rotationId),
      favoritedByMe: engagement.favorited.has(rotationId),
    };
  }

  private async bossImages(rows: RotationRow[]) {
    const slugs = new Set<string>();
    for (const row of rows) {
      for (const stop of row.bosses) {
        if (stop.boss?.slug) {
          slugs.add(stop.boss.slug);
        }
      }
    }
    if (slugs.size === 0) {
      return new Map<string, string | null>();
    }
    const creatures = await this.prisma.creature.findMany({
      where: { slug: { in: [...slugs] }, isActive: true },
      select: { slug: true, image: true },
    });
    return new Map(creatures.map((row) => [row.slug, row.image]));
  }

  private serializeCard(
    row: RotationRow,
    engagement: EngagementState,
    images: Map<string, string | null>,
    featured: boolean,
  ) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      accessRequirements: row.accessRequirements,
      additionalInfo: row.additionalInfo,
      recommendedLevel: row.recommendedLevel,
      recommendedLevelLabel:
        COMMUNITY_ROTATION_LEVEL_LABELS[row.recommendedLevel],
      huntMode: row.huntMode,
      plannedDurationMinutes: row.plannedDurationMinutes,
      vocation: row.vocation,
      characterLevel: row.characterLevel,
      partySize: row.partySize,
      observedTotalMinutes: row.observedTotalMinutes,
      combatMinutes: row.combatMinutes,
      travelMinutes: row.travelMinutes,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        id: row.user.id,
        name: row.user.activeCharacter?.name ?? null,
        vocation: row.user.activeCharacter?.vocation ?? null,
        level: row.user.activeCharacter?.level ?? null,
      },
      bosses: row.bosses.map((stop) => {
        const slug = stop.boss?.slug ?? null;
        const name = stop.boss?.name ?? stop.bossName;
        return {
          id: stop.id,
          position: stop.position,
          notes: stop.notes,
          bossId: stop.bossId,
          bossName: stop.bossName,
          slug,
          name,
          image: slug ? (images.get(slug) ?? null) : null,
        };
      }),
      likesCount: row._count.likes,
      favoritesCount: row._count.favorites,
      commentsCount: row._count.comments,
      likedByMe: engagement.liked.has(row.id),
      favoritedByMe: engagement.favorited.has(row.id),
      testedByAuthor: engagement.authorTested.has(row.id),
      testedByMe: engagement.testedByMe.has(row.id),
      featured,
    };
  }

  private serializeTest(row: {
    id: string;
    rotationId: string;
    userId: string;
    vocation: string | null;
    characterLevel: number | null;
    partySize: number | null;
    combatMinutes: number | null;
    travelMinutes: number | null;
    totalMinutes: number | null;
    notes: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      rotationId: row.rotationId,
      userId: row.userId,
      vocation: row.vocation,
      characterLevel: row.characterLevel,
      partySize: row.partySize,
      combatMinutes: row.combatMinutes,
      travelMinutes: row.travelMinutes,
      totalMinutes: row.totalMinutes,
      notes: row.notes,
      createdAt: row.createdAt,
    };
  }

  private async recordPublishReward(
    tx: Prisma.TransactionClient,
    userId: string,
    rotationId: string,
  ) {
    try {
      await this.rewardsService.recordEvent(
        userId,
        COMMUNITY_ROTATION_PUBLISHED_EVENT,
        {
          referenceType: 'CommunityRotation',
          referenceId: rotationId,
        },
        new Date(),
        tx,
      );
    } catch (error) {
      if (isUnsupportedRewardEvent(error)) {
        return;
      }
      throw error;
    }
  }
}

function emptyEngagement(): EngagementState {
  return {
    liked: new Set(),
    favorited: new Set(),
    authorTested: new Set(),
    testedByMe: new Set(),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isUnsupportedRewardEvent(error: unknown) {
  if (!(error instanceof BadRequestException)) {
    return false;
  }
  const payload = error.getResponse();
  const message =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' &&
          payload !== null &&
          'message' in payload
        ? String((payload as { message: unknown }).message)
        : '';
  return message.includes('Invalid reward event');
}
