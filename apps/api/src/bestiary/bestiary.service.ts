import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { publicHttpsUrl } from '../common/https-url';
import { pageResult, resolvePage } from '../common/pagination';
import { ListBestiaryQueryDto } from './dto/list-bestiary-query.dto';
import { UpdateBestiaryProgressDto } from './dto/update-bestiary-progress.dto';

const CREATURE_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  image: true,
  hp: true,
  experience: true,
  difficulty: true,
  youtubeUrl: true,
  elements: {
    select: { element: true, modifier: true },
    orderBy: { modifier: 'desc' as const },
  },
  locations: {
    select: { name: true, region: true },
    orderBy: { name: 'asc' as const },
  },
  togetherFrom: {
    select: {
      relatedCreature: {
        select: { id: true, name: true, slug: true, image: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CreatureSelect;

const BESTIARY_ENTRY_SELECT = {
  category: true,
  killsRequired: true,
  estimatedKillsPerHour: true,
  charmPoints: true,
} as const;

@Injectable()
export class BestiaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListBestiaryQueryDto, userId?: string) {
    const where = this.creatureWhere(query);
    const { page, limit, skip } = resolvePage(query);
    const [total, creatures] = await Promise.all([
      this.prisma.creature.count({ where }),
      this.prisma.creature.findMany({
        where,
        select: {
          ...CREATURE_LIST_SELECT,
          bestiaryEntry: { select: BESTIARY_ENTRY_SELECT },
          userProgress: this.progressSelect(userId),
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return pageResult(
      creatures.map((creature) => this.mapCreature(creature, userId)),
      total,
      page,
      limit,
    );
  }

  async findBySlug(slug: string, userId?: string) {
    const creature = await this.prisma.creature.findFirst({
      where: { slug, isActive: true },
      select: {
        ...CREATURE_LIST_SELECT,
        description: true,
        bestiaryEntry: {
          select: { ...BESTIARY_ENTRY_SELECT, notes: true },
        },
        userProgress: this.progressSelect(userId),
      },
    });

    if (!creature) {
      throw new NotFoundException('Creature not found');
    }

    return this.mapCreature(creature, userId, true);
  }

  async updateProgress(
    userId: string,
    slug: string,
    dto: UpdateBestiaryProgressDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.bestiaryEntry.findFirst({
        where: { creature: { slug, isActive: true } },
        select: {
          creatureId: true,
          killsRequired: true,
        },
      });

      if (!entry) {
        throw new NotFoundException('Bestiary entry not found');
      }

      const existing = await tx.userBestiaryProgress.findUnique({
        where: {
          userId_creatureId: { userId, creatureId: entry.creatureId },
        },
        select: { kills: true, completedAt: true },
      });

      const currentKills = existing?.kills ?? 0;
      if (dto.kills < currentKills) {
        throw new BadRequestException('Bestiary progress cannot decrease');
      }

      const completed = dto.kills >= entry.killsRequired;
      const completedAt = completed
        ? (existing?.completedAt ?? new Date())
        : null;
      const data = {
        kills: dto.kills,
        completed,
        completedAt,
      };

      if (!existing) {
        await tx.userBestiaryProgress.createMany({
          data: [
            {
              userId,
              creatureId: entry.creatureId,
              ...data,
            },
          ],
          skipDuplicates: true,
        });
      }

      const updated = await tx.userBestiaryProgress.updateMany({
        where: {
          userId,
          creatureId: entry.creatureId,
          kills: { lte: dto.kills },
        },
        data,
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Bestiary progress cannot decrease');
      }

      const progress = await tx.userBestiaryProgress.findUniqueOrThrow({
        where: {
          userId_creatureId: { userId, creatureId: entry.creatureId },
        },
        select: {
          kills: true,
          completed: true,
          completedAt: true,
        },
      });

      return {
        creatureId: entry.creatureId,
        killsRequired: entry.killsRequired,
        ...this.mapProgress(progress, entry.killsRequired, userId),
      };
    });
  }

  private creatureWhere(
    query: ListBestiaryQueryDto,
  ): Prisma.CreatureWhereInput {
    const where: Prisma.CreatureWhereInput = { isActive: true };
    if (query.difficulty) {
      where.difficulty = query.difficulty;
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        {
          locations: {
            some: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { region: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          togetherFrom: {
            some: {
              relatedCreature: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }
    return where;
  }

  private progressSelect(userId?: string) {
    if (!userId) {
      return false as const;
    }
    return {
      where: { userId },
      select: {
        kills: true,
        completed: true,
        completedAt: true,
      },
      take: 1,
    };
  }

  private mapCreature(
    creature: {
      id: string;
      name: string;
      slug: string;
      image: string;
      hp: number | null;
      experience: number | null;
      difficulty: string | null;
      youtubeUrl: string | null;
      description?: string | null;
      elements: { element: string; modifier: number }[];
      locations: { name: string; region: string | null }[];
      togetherFrom: {
        relatedCreature: {
          id: string;
          name: string;
          slug: string;
          image: string;
        };
      }[];
      bestiaryEntry: {
        category: string | null;
        killsRequired: number;
        estimatedKillsPerHour: number | null;
        charmPoints: number | null;
        notes?: string | null;
      } | null;
      userProgress?: {
        kills: number;
        completed: boolean;
        completedAt: Date | null;
      }[];
    },
    userId?: string,
    detail = false,
  ) {
    const entry = creature.bestiaryEntry;
    const killsRequired = entry?.killsRequired ?? null;
    return this.mapEntry(
      {
        category: entry?.category ?? null,
        killsRequired,
        estimatedKillsPerHour: entry?.estimatedKillsPerHour ?? null,
        charmPoints: entry?.charmPoints ?? null,
        creature,
      },
      userId,
      detail ? (entry?.notes ?? null) : undefined,
    );
  }

  private mapEntry(
    entry: {
      category: string | null;
      killsRequired: number | null;
      estimatedKillsPerHour: number | null;
      charmPoints: number | null;
      creature: {
        id: string;
        name: string;
        slug: string;
        image: string;
        hp: number | null;
        experience: number | null;
        difficulty: string | null;
        youtubeUrl: string | null;
        description?: string | null;
        elements: { element: string; modifier: number }[];
        locations: { name: string; region: string | null }[];
        togetherFrom: {
          relatedCreature: {
            id: string;
            name: string;
            slug: string;
            image: string;
          };
        }[];
        userProgress?: {
          kills: number;
          completed: boolean;
          completedAt: Date | null;
        }[];
      };
    },
    userId?: string,
    notes?: string | null,
  ) {
    const { creature } = entry;
    return {
      id: creature.id,
      name: creature.name,
      slug: creature.slug,
      image: creature.image,
      hp: creature.hp,
      experience: creature.experience,
      difficulty: creature.difficulty,
      youtubeUrl: publicHttpsUrl(creature.youtubeUrl),
      ...(notes !== undefined
        ? { description: creature.description, notes }
        : {}),
      category: entry.category,
      killsRequired: entry.killsRequired,
      estimatedKillsPerHour: entry.estimatedKillsPerHour,
      charmPoints: entry.charmPoints,
      estimatedHours:
        entry.killsRequired == null
          ? null
          : estimatedHours(entry.killsRequired, entry.estimatedKillsPerHour),
      elements: creature.elements,
      locations: creature.locations,
      together: creature.togetherFrom.map((item) => item.relatedCreature),
      progress:
        entry.killsRequired == null
          ? null
          : this.mapProgress(
              creature.userProgress?.[0],
              entry.killsRequired,
              userId,
            ),
    };
  }

  private mapProgress(
    row:
      | { kills: number; completed: boolean; completedAt: Date | null }
      | undefined,
    killsRequired: number,
    userId?: string,
  ) {
    if (!userId) {
      return null;
    }
    const kills = row?.kills ?? 0;
    return {
      kills,
      completed: row?.completed ?? false,
      completedAt: row?.completedAt ?? null,
      progressPercentage: progressPercentage(kills, killsRequired),
    };
  }
}

export function estimatedHours(
  killsRequired: number,
  estimatedKillsPerHour: number | null,
) {
  if (!estimatedKillsPerHour || estimatedKillsPerHour <= 0) {
    return null;
  }
  return Math.ceil(killsRequired / estimatedKillsPerHour);
}

export function progressPercentage(kills: number, killsRequired: number) {
  if (killsRequired <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((kills / killsRequired) * 1000) / 10);
}
