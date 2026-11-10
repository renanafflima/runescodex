import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CharmGuideStatus,
  Prisma,
  TicketImpact,
  TicketOrigin,
  TicketProblemType,
  TicketStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { createTicketProtocol } from '../admin/insights/admin-text';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeCharmGuideTotals,
  markRepeatedCreatures,
} from './charm-guide-totals';
import { CharmGuideStepDto } from './dto/charm-guide-step.dto';
import { CreateCharmGuideDto } from './dto/create-charm-guide.dto';
import {
  CharmGuideSort,
  ListCharmGuidesQueryDto,
} from './dto/list-charm-guides-query.dto';
import { UpdateCharmGuideDto } from './dto/update-charm-guide.dto';
import { UpdateCharmGuideProgressDto } from './dto/update-charm-guide-progress.dto';
import { createHash } from 'node:crypto';

const EDITABLE = new Set<CharmGuideStatus>([
  CharmGuideStatus.DRAFT,
  CharmGuideStatus.CHANGES_REQUESTED,
  CharmGuideStatus.REJECTED,
]);

const GUIDE_CARD_INCLUDE = {
  user: {
    select: {
      id: true,
      activeCharacter: { select: { name: true } },
    },
  },
  _count: {
    select: { likes: true, favorites: true, comments: true, steps: true },
  },
} satisfies Prisma.CharmGuideInclude;

const GUIDE_DETAIL_INCLUDE = {
  ...GUIDE_CARD_INCLUDE,
  steps: {
    orderBy: { position: 'asc' as const },
    include: {
      hunt: { select: { id: true, slug: true, name: true } },
      creatures: {
        orderBy: { position: 'asc' as const },
        include: {
          creature: {
            select: {
              id: true,
              slug: true,
              name: true,
              image: true,
              difficulty: true,
              bestiaryEntry: { select: { charmPoints: true } },
            },
          },
        },
      },
    },
  },
  ticket: { select: { id: true, protocol: true, status: true } },
} satisfies Prisma.CharmGuideInclude;

@Injectable()
export class CharmGuidesService {
  constructor(private readonly prisma: PrismaService) {}

  async categorySummary() {
    const rows = await this.prisma.charmGuide.groupBy({
      by: ['cpCategory'],
      where: { status: CharmGuideStatus.PUBLISHED },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      rows.map((row) => [row.cpCategory, row._count._all]),
    );
    return {
      categories: [
        { cpCategory: 'CP_100', targetPoints: 100, label: 'Fácil', guideCount: counts.CP_100 ?? 0 },
        { cpCategory: 'CP_200', targetPoints: 200, label: 'Médio', guideCount: counts.CP_200 ?? 0 },
        { cpCategory: 'CP_300', targetPoints: 300, label: 'Avançado', guideCount: counts.CP_300 ?? 0 },
        { cpCategory: 'CP_500', targetPoints: 500, label: 'Desafiador', guideCount: counts.CP_500 ?? 0 },
      ],
    };
  }

  async list(query: ListCharmGuidesQueryDto, userId?: string) {
    const { page, limit, skip } = resolvePage(query);
    const where: Prisma.CharmGuideWhereInput = {
      status: CharmGuideStatus.PUBLISHED,
      ...(query.cpCategory ? { cpCategory: query.cpCategory } : {}),
    };
    const orderBy =
      query.sort === CharmGuideSort.LIKED
        ? [{ likes: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [total, rows] = await Promise.all([
      this.prisma.charmGuide.count({ where }),
      this.prisma.charmGuide.findMany({
        where,
        include: GUIDE_CARD_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
    ]);
    const engagement = userId
      ? await this.engagement(
          rows.map((row) => row.id),
          userId,
        )
      : { liked: new Set<string>(), favorited: new Set<string>() };

    return pageResult(
      rows.map((row) => this.serializeCard(row, engagement)),
      total,
      page,
      limit,
    );
  }

  async findOne(
    id: string,
    userId?: string,
    characterId?: string,
    options?: { allowStaff?: boolean },
  ) {
    const guide = await this.prisma.charmGuide.findUnique({
      where: { id },
      include: GUIDE_DETAIL_INCLUDE,
    });
    if (!guide) throw new NotFoundException('Guia não encontrado.');
    if (
      guide.status !== CharmGuideStatus.PUBLISHED &&
      guide.userId !== userId &&
      !options?.allowStaff
    ) {
      throw new NotFoundException('Guia não encontrado.');
    }
    const engagement = userId
      ? await this.engagement([guide.id], userId)
      : { liked: new Set<string>(), favorited: new Set<string>() };
    const progress = characterId
      ? await this.progressRowsForGuide(id, characterId)
      : [];
    return this.serializeDetail(guide, engagement, progress);
  }

  async create(userId: string, dto: CreateCharmGuideDto) {
    const prepared = await this.prepareSteps(dto.steps);
    return this.prisma.$transaction(async (tx) => {
      const guide = await tx.charmGuide.create({
        data: {
          userId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          coverImage: dto.coverImage?.trim() || null,
          cpCategory: dto.cpCategory,
          difficulty: dto.difficulty,
          status: CharmGuideStatus.DRAFT,
          totalCharmPoints: prepared.totals.totalCharmPoints,
          uniqueCreatureCount: prepared.totals.uniqueCreatureCount,
          stepCount: prepared.totals.stepCount,
          steps: { create: prepared.stepCreates },
        },
        include: GUIDE_DETAIL_INCLUDE,
      });
      return this.serializeDetail(guide, {
        liked: new Set(),
        favorited: new Set(),
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateCharmGuideDto) {
    const current = await this.requireOwnedEditable(id, userId);
    const prepared = dto.steps ? await this.prepareSteps(dto.steps) : null;
    return this.prisma.$transaction(async (tx) => {
      if (prepared) {
        await tx.charmGuideStep.deleteMany({ where: { guideId: current.id } });
      }
      const guide = await tx.charmGuide.update({
        where: { id: current.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.cpCategory !== undefined ? { cpCategory: dto.cpCategory } : {}),
          ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
          ...(dto.coverImage !== undefined
            ? { coverImage: dto.coverImage?.trim() || null }
            : {}),
          ...(prepared
            ? {
                totalCharmPoints: prepared.totals.totalCharmPoints,
                uniqueCreatureCount: prepared.totals.uniqueCreatureCount,
                stepCount: prepared.totals.stepCount,
                steps: { create: prepared.stepCreates },
              }
            : {}),
          status:
            current.status === CharmGuideStatus.REJECTED ||
            current.status === CharmGuideStatus.CHANGES_REQUESTED
              ? CharmGuideStatus.DRAFT
              : current.status,
        },
        include: GUIDE_DETAIL_INCLUDE,
      });
      return this.serializeDetail(guide, {
        liked: new Set(),
        favorited: new Set(),
      });
    });
  }

  async archive(userId: string, id: string) {
    const current = await this.requireOwned(id, userId);
    await this.prisma.charmGuide.update({
      where: { id: current.id },
      data: { status: CharmGuideStatus.ARCHIVED },
    });
    return { id: current.id, status: CharmGuideStatus.ARCHIVED };
  }

  async submit(userId: string, id: string, idempotencyKey?: string) {
    const guide = await this.requireOwnedEditable(id, userId);
    if (guide.stepCount < 1 || guide.uniqueCreatureCount < 1) {
      throw new BadRequestException(
        'O guia precisa ter pelo menos uma etapa com criaturas.',
      );
    }
    const key = (idempotencyKey || `submit:${id}`).slice(0, 120);
    const payloadHash = createHash('sha256')
      .update(`${id}:${guide.updatedAt.toISOString()}`)
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.charmGuidePublishIdempotency.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (existing?.ticketId) {
        const fresh = await tx.charmGuide.findUniqueOrThrow({
          where: { id },
          include: GUIDE_DETAIL_INCLUDE,
        });
        return this.serializeDetail(fresh, {
          liked: new Set(),
          favorited: new Set(),
        });
      }

      const existingTicket = await tx.ticket.findFirst({
        where: { charmGuideId: id },
        orderBy: { createdAt: 'desc' },
      });
      // WAITING_ON_USER is left after CHANGES_REQUESTED and must be reopenable.
      const blockingTicketStatuses: TicketStatus[] = [
        TicketStatus.OPEN,
        TicketStatus.IN_REVIEW,
        TicketStatus.WAITING_ON_STAFF,
      ];
      if (
        existingTicket &&
        blockingTicketStatuses.includes(existingTicket.status)
      ) {
        throw new ConflictException(
          'Já existe um chamado em aberto para este guia.',
        );
      }

      const ticketPayload = {
        status: TicketStatus.OPEN,
        problemType: TicketProblemType.CHARM_GUIDE,
        impact: TicketImpact.MEDIUM,
        origin: TicketOrigin.BESTIARY,
        description: `Guia de Charm Points enviado para análise: ${guide.title} (${guide.cpCategory}).`,
        catalogValue: String(guide.totalCharmPoints),
        userValue: guide.cpCategory,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      };

      // Ticket.charmGuideId is 1:1 — reopen the existing chamado on resubmit.
      const ticket = existingTicket
        ? await tx.ticket.update({
            where: { id: existingTicket.id },
            data: ticketPayload,
          })
        : await tx.ticket.create({
            data: {
              protocol: createTicketProtocol(),
              authorId: userId,
              charmGuideId: id,
              ...ticketPayload,
            },
          });

      const updated = await tx.charmGuide.update({
        where: { id },
        data: { status: CharmGuideStatus.PENDING_REVIEW },
        include: GUIDE_DETAIL_INCLUDE,
      });

      await tx.charmGuidePublishIdempotency.upsert({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        create: {
          userId,
          idempotencyKey: key,
          payloadHash,
          guideId: id,
          ticketId: ticket.id,
        },
        update: {
          payloadHash,
          guideId: id,
          ticketId: ticket.id,
        },
      });

      return this.serializeDetail(updated, {
        liked: new Set(),
        favorited: new Set(),
      });
    });
  }

  async like(userId: string, id: string) {
    await this.requirePublished(id);
    await this.prisma.charmGuideLike.upsert({
      where: { guideId_userId: { guideId: id, userId } },
      create: { guideId: id, userId },
      update: {},
    });
    return { liked: true };
  }

  async unlike(userId: string, id: string) {
    await this.prisma.charmGuideLike.deleteMany({
      where: { guideId: id, userId },
    });
    return { liked: false };
  }

  async favorite(userId: string, id: string) {
    await this.requirePublished(id);
    await this.prisma.charmGuideFavorite.upsert({
      where: { guideId_userId: { guideId: id, userId } },
      create: { guideId: id, userId },
      update: {},
    });
    return { favorited: true };
  }

  async unfavorite(userId: string, id: string) {
    await this.prisma.charmGuideFavorite.deleteMany({
      where: { guideId: id, userId },
    });
    return { favorited: false };
  }

  async updateProgress(
    userId: string,
    guideId: string,
    dto: UpdateCharmGuideProgressDto,
  ) {
    await this.requirePublished(guideId);
    const character = await this.prisma.character.findFirst({
      where: { id: dto.characterId, userId },
      select: { id: true },
    });
    if (!character) {
      throw new ForbiddenException('Personagem inválido.');
    }
    const inGuide = await this.prisma.charmGuideStepCreature.findFirst({
      where: {
        creatureId: dto.creatureId,
        step: { guideId },
      },
      select: { id: true },
    });
    if (!inGuide) {
      throw new BadRequestException('Criatura não faz parte deste guia.');
    }
    if (dto.completed) {
      await this.markCreatureCompletedForCharacter(
        userId,
        dto.characterId,
        dto.creatureId,
      );
    } else {
      await this.prisma.charmGuideCreatureProgress.deleteMany({
        where: {
          characterId: dto.characterId,
          creatureId: dto.creatureId,
        },
      });
    }
    return this.progressSummary(guideId, dto.characterId);
  }

  async progressSummary(guideId: string, characterId: string) {
    const guide = await this.requirePublished(guideId);
    const completedIds = await this.completedCreatureIdsForCharacter(characterId);
    const creatures = await this.prisma.charmGuideStepCreature.findMany({
      where: { step: { guideId } },
      select: {
        creatureId: true,
        creature: { select: { bestiaryEntry: { select: { charmPoints: true } } } },
      },
    });
    const unique = new Map<string, number>();
    for (const row of creatures) {
      if (!unique.has(row.creatureId)) {
        unique.set(row.creatureId, row.creature.bestiaryEntry?.charmPoints ?? 0);
      }
    }
    let completedPoints = 0;
    let completedInGuide = 0;
    const completedInThisGuide: string[] = [];
    for (const [creatureId, points] of unique) {
      if (!completedIds.has(creatureId)) continue;
      completedPoints += points;
      completedInGuide += 1;
      completedInThisGuide.push(creatureId);
    }
    return {
      guideId,
      characterId,
      totalCharmPoints: guide.totalCharmPoints,
      completedCharmPoints: completedPoints,
      uniqueCreatureCount: unique.size,
      completedCreatureCount: completedInGuide,
      completedCreatureIds: completedInThisGuide,
    };
  }

  private async prepareSteps(steps: CharmGuideStepDto[]) {
    const creatureIds = [
      ...new Set(steps.flatMap((step) => step.creatureIds)),
    ];
    const huntIds = [
      ...new Set(
        steps
          .map((step) => step.huntId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [creatures, hunts] = await Promise.all([
      this.prisma.creature.findMany({
        where: { id: { in: creatureIds }, isActive: true },
        select: {
          id: true,
          bestiaryEntry: { select: { charmPoints: true } },
        },
      }),
      huntIds.length
        ? this.prisma.hunt.findMany({
            where: { id: { in: huntIds }, isActive: true },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (creatures.length !== creatureIds.length) {
      throw new BadRequestException(
        'Uma ou mais criaturas são inválidas ou inativas.',
      );
    }
    if (hunts.length !== huntIds.length) {
      throw new BadRequestException(
        'Uma ou mais hunts são inválidas ou inativas.',
      );
    }

    for (const step of steps) {
      if (new Set(step.creatureIds).size !== step.creatureIds.length) {
        throw new BadRequestException(
          'Não é permitido repetir a mesma criatura na mesma etapa.',
        );
      }
    }

    const points = new Map(
      creatures.map((creature) => [
        creature.id,
        creature.bestiaryEntry?.charmPoints ?? null,
      ]),
    );
    const totals = computeCharmGuideTotals(
      steps.map((step) => ({ creatureIds: step.creatureIds })),
      points,
    );

    const stepCreates = steps.map((step, index) => ({
      position: index + 1,
      huntId: step.huntId ?? null,
      title: step.title?.trim() || null,
      notes: step.notes?.trim() || null,
      creatures: {
        create: step.creatureIds.map((creatureId, creatureIndex) => ({
          creatureId,
          position: creatureIndex + 1,
        })),
      },
    }));

    return { totals, stepCreates };
  }

  private async completedCreatureIdsForCharacter(characterId: string) {
    const rows = await this.prisma.charmGuideCreatureProgress.findMany({
      where: { characterId },
      select: { creatureId: true },
      distinct: ['creatureId'],
    });
    return new Set(rows.map((row) => row.creatureId));
  }

  private async progressRowsForGuide(guideId: string, characterId: string) {
    const creatureIds = await this.prisma.charmGuideStepCreature.findMany({
      where: { step: { guideId } },
      select: { creatureId: true },
      distinct: ['creatureId'],
    });
    const ids = creatureIds.map((row) => row.creatureId);
    if (ids.length === 0) return [];
    const completed = await this.prisma.charmGuideCreatureProgress.findMany({
      where: { characterId, creatureId: { in: ids } },
      select: { creatureId: true, completedAt: true },
      distinct: ['creatureId'],
    });
    return completed;
  }

  private async markCreatureCompletedForCharacter(
    userId: string,
    characterId: string,
    creatureId: string,
  ) {
    const guideIds = await this.prisma.charmGuideStep.findMany({
      where: {
        creatures: { some: { creatureId } },
        guide: { status: CharmGuideStatus.PUBLISHED },
      },
      select: { guideId: true },
      distinct: ['guideId'],
    });
    const now = new Date();
    await Promise.all(
      guideIds.map((row) =>
        this.prisma.charmGuideCreatureProgress.upsert({
          where: {
            characterId_guideId_creatureId: {
              characterId,
              guideId: row.guideId,
              creatureId,
            },
          },
          create: {
            userId,
            characterId,
            guideId: row.guideId,
            creatureId,
            completedAt: now,
          },
          update: { completedAt: now },
        }),
      ),
    );
  }

  private async engagement(guideIds: string[], userId: string) {
    if (guideIds.length === 0) {
      return { liked: new Set<string>(), favorited: new Set<string>() };
    }
    const [likes, favorites] = await Promise.all([
      this.prisma.charmGuideLike.findMany({
        where: { userId, guideId: { in: guideIds } },
        select: { guideId: true },
      }),
      this.prisma.charmGuideFavorite.findMany({
        where: { userId, guideId: { in: guideIds } },
        select: { guideId: true },
      }),
    ]);
    return {
      liked: new Set(likes.map((row) => row.guideId)),
      favorited: new Set(favorites.map((row) => row.guideId)),
    };
  }

  private serializeCard(
    row: Prisma.CharmGuideGetPayload<{ include: typeof GUIDE_CARD_INCLUDE }>,
    engagement: { liked: Set<string>; favorited: Set<string> },
  ) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      coverImage: row.coverImage,
      cpCategory: row.cpCategory,
      difficulty: row.difficulty,
      status: row.status,
      totalCharmPoints: row.totalCharmPoints,
      uniqueCreatureCount: row.uniqueCreatureCount,
      stepCount: row.stepCount,
      likeCount: row._count.likes,
      favoriteCount: row._count.favorites,
      commentCount: row._count.comments,
      likedByMe: engagement.liked.has(row.id),
      favoritedByMe: engagement.favorited.has(row.id),
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      author: {
        id: row.user.id,
        name: row.user.activeCharacter?.name ?? 'Jogador',
      },
    };
  }

  private serializeDetail(
    row: Prisma.CharmGuideGetPayload<{ include: typeof GUIDE_DETAIL_INCLUDE }>,
    engagement: { liked: Set<string>; favorited: Set<string> },
    progress: Array<{ creatureId: string; completedAt: Date }> = [],
  ) {
    const completed = new Set(progress.map((row) => row.creatureId));
    const marked = markRepeatedCreatures(
      row.steps.map((step) => ({
        creatureIds: step.creatures.map((entry) => entry.creatureId),
      })),
    );
    return {
      ...this.serializeCard(row, engagement),
      adminResponse: row.adminResponse,
      ticket: row.ticket,
      steps: row.steps.map((step, stepIndex) => ({
        id: step.id,
        position: step.position,
        title: step.title,
        notes: step.notes,
        hunt: step.hunt,
        creatures: step.creatures.map((entry, creatureIndex) => {
          const charmPoints = entry.creature.bestiaryEntry?.charmPoints ?? null;
          const countsTowardTotal = marked[stepIndex]?.firstSeen[creatureIndex] ?? true;
          return {
            id: entry.creature.id,
            slug: entry.creature.slug,
            name: entry.creature.name,
            image: entry.creature.image,
            difficulty: entry.creature.difficulty,
            charmPoints,
            countsTowardTotal,
            repeatedFromEarlierStep: !countsTowardTotal,
            completed: completed.has(entry.creature.id),
          };
        }),
      })),
      progress: {
        completedCreatureIds: [...completed],
      },
    };
  }

  private async requireOwned(id: string, userId: string) {
    const guide = await this.prisma.charmGuide.findUnique({ where: { id } });
    if (!guide) throw new NotFoundException('Guia não encontrado.');
    if (guide.userId !== userId) {
      throw new ForbiddenException('Você não pode alterar este guia.');
    }
    return guide;
  }

  private async requireOwnedEditable(id: string, userId: string) {
    const guide = await this.requireOwned(id, userId);
    if (!EDITABLE.has(guide.status)) {
      throw new BadRequestException(
        'Este guia não pode ser editado no status atual.',
      );
    }
    return guide;
  }

  private async requirePublished(id: string) {
    const guide = await this.prisma.charmGuide.findUnique({ where: { id } });
    if (!guide || guide.status !== CharmGuideStatus.PUBLISHED) {
      throw new NotFoundException('Guia não encontrado.');
    }
    return guide;
  }

  /** Used by admin moderation. */
  async adminModerate(
    actorId: string,
    id: string,
    status:
      | typeof CharmGuideStatus.PUBLISHED
      | typeof CharmGuideStatus.REJECTED
      | typeof CharmGuideStatus.CHANGES_REQUESTED,
    adminResponse?: string,
  ) {
    const guide = await this.prisma.charmGuide.findUnique({ where: { id } });
    if (!guide) throw new NotFoundException('Guia não encontrado.');
    if (guide.status !== CharmGuideStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Somente guias em análise podem ser moderados.',
      );
    }
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    if (actor?.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.charmGuide.update({
        where: { id },
        data: {
          status,
          adminResponse: adminResponse ?? null,
          moderatedByUserId: actorId,
          moderatedAt: new Date(),
          publishedAt:
            status === CharmGuideStatus.PUBLISHED ? new Date() : null,
        },
        include: GUIDE_DETAIL_INCLUDE,
      });
      const ticket = await tx.ticket.findFirst({
        where: { charmGuideId: id },
        orderBy: { createdAt: 'desc' },
      });
      if (ticket) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status:
              status === CharmGuideStatus.PUBLISHED
                ? TicketStatus.RESOLVED
                : status === CharmGuideStatus.REJECTED
                  ? TicketStatus.REJECTED
                  : TicketStatus.WAITING_ON_USER,
            resolutionNote: adminResponse ?? null,
            resolvedAt:
              status === CharmGuideStatus.PUBLISHED ||
              status === CharmGuideStatus.REJECTED
                ? new Date()
                : null,
            resolvedByUserId:
              status === CharmGuideStatus.PUBLISHED ||
              status === CharmGuideStatus.REJECTED
                ? actorId
                : null,
          },
        });
      }
      return this.serializeDetail(updated, {
        liked: new Set(),
        favorited: new Set(),
      });
    });
  }

  async adminList(status?: CharmGuideStatus) {
    const where = status ? { status } : { status: CharmGuideStatus.PENDING_REVIEW };
    const rows = await this.prisma.charmGuide.findMany({
      where,
      include: GUIDE_CARD_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map((row) =>
      this.serializeCard(row, { liked: new Set(), favorited: new Set() }),
    );
  }
}
