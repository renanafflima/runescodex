import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class BestiaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListBestiaryQueryDto, userId?: string) {
    const entries = await this.prisma.bestiaryEntry.findMany({
      where: {
        creature: {
          isActive: true,
          ...(query.difficulty ? { difficulty: query.difficulty } : {}),
        },
      },
      select: {
        category: true,
        killsRequired: true,
        estimatedKillsPerHour: true,
        charmPoints: true,
        creature: {
          select: {
            ...CREATURE_LIST_SELECT,
            userProgress: userId
              ? {
                  where: { userId },
                  select: {
                    kills: true,
                    completed: true,
                    completedAt: true,
                  },
                  take: 1,
                }
              : false,
          },
        },
      },
      orderBy: { creature: { name: 'asc' } },
    });

    return entries.map((entry) => this.mapEntry(entry, userId));
  }

  async findBySlug(slug: string, userId?: string) {
    const entry = await this.prisma.bestiaryEntry.findFirst({
      where: {
        creature: { slug, isActive: true },
      },
      select: {
        notes: true,
        category: true,
        killsRequired: true,
        estimatedKillsPerHour: true,
        charmPoints: true,
        creature: {
          select: {
            ...CREATURE_LIST_SELECT,
            description: true,
            userProgress: userId
              ? {
                  where: { userId },
                  select: {
                    kills: true,
                    completed: true,
                    completedAt: true,
                  },
                  take: 1,
                }
              : false,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Bestiary entry not found');
    }

    return this.mapEntry(entry, userId, entry.notes);
  }

  async updateProgress(
    userId: string,
    slug: string,
    dto: UpdateBestiaryProgressDto,
  ) {
    const entry = await this.prisma.bestiaryEntry.findFirst({
      where: { creature: { slug, isActive: true } },
      select: {
        creatureId: true,
        killsRequired: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Bestiary entry not found');
    }

    const existing = await this.prisma.userBestiaryProgress.findUnique({
      where: {
        userId_creatureId: { userId, creatureId: entry.creatureId },
      },
      select: { completedAt: true },
    });

    const completed = dto.kills >= entry.killsRequired;
    const completedAt = completed
      ? (existing?.completedAt ?? new Date())
      : null;

    const progress = await this.prisma.userBestiaryProgress.upsert({
      where: {
        userId_creatureId: { userId, creatureId: entry.creatureId },
      },
      create: {
        userId,
        creatureId: entry.creatureId,
        kills: dto.kills,
        completed,
        completedAt,
      },
      update: {
        kills: dto.kills,
        completed,
        completedAt,
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
  }

  private mapEntry(
    entry: {
      category: string | null;
      killsRequired: number;
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
      youtubeUrl: creature.youtubeUrl,
      ...(notes !== undefined
        ? { description: creature.description, notes }
        : {}),
      category: entry.category,
      killsRequired: entry.killsRequired,
      estimatedKillsPerHour: entry.estimatedKillsPerHour,
      charmPoints: entry.charmPoints,
      estimatedHours: estimatedHours(
        entry.killsRequired,
        entry.estimatedKillsPerHour,
      ),
      elements: creature.elements,
      locations: creature.locations,
      together: creature.togetherFrom.map((item) => item.relatedCreature),
      progress: this.mapProgress(
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
