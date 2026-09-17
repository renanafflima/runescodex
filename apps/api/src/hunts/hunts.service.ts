import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { ListHuntsQueryDto } from './dto/list-hunts-query.dto';

const VOCATION_SELECT = {
  vocation: true,
  isRecommended: true,
  levelMin: true,
  levelMax: true,
  xpPerHour: true,
  profitPerHour: true,
  difficulty: true,
  notes: true,
} as const;

const CREATURE_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  image: true,
} as const;

const ELEMENT_SELECT = {
  element: true,
  modifier: true,
} as const;

const HUNT_LIST_INCLUDE = {
  vocations: {
    select: VOCATION_SELECT,
    orderBy: { vocation: 'asc' as const },
  },
  creatures: {
    select: {
      isPrimary: true,
      recommendedCharm: true,
      creature: { select: CREATURE_SUMMARY_SELECT },
    },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.HuntInclude;

const HUNT_DETAIL_INCLUDE = {
  vocations: {
    select: VOCATION_SELECT,
    orderBy: { vocation: 'asc' as const },
  },
  creatures: {
    select: {
      id: true,
      damageType: true,
      isPrimary: true,
      quantity: true,
      recommendedCharm: true,
      notes: true,
      creature: {
        select: {
          ...CREATURE_SUMMARY_SELECT,
          hp: true,
          experience: true,
          difficulty: true,
          youtubeUrl: true,
          elements: {
            select: ELEMENT_SELECT,
            orderBy: { modifier: 'desc' as const },
          },
        },
      },
    },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
  },
  loot: {
    select: {
      id: true,
      itemName: true,
      itemImage: true,
      estimatedValue: true,
      importance: true,
    },
    orderBy: [{ importance: 'asc' as const }, { itemName: 'asc' as const }],
  },
  videos: {
    select: {
      id: true,
      title: true,
      url: true,
      channel: true,
      isRecommended: true,
    },
    orderBy: [
      { isRecommended: 'desc' as const },
      { createdAt: 'asc' as const },
    ],
  },
} satisfies Prisma.HuntInclude;

@Injectable()
export class HuntsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListHuntsQueryDto) {
    const hunts = await this.prisma.hunt.findMany({
      where: this.listWhere(query),
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        subLocation: true,
        difficulty: true,
        respawn: true,
        heroImage: true,
        mapImage: true,
        vocations: HUNT_LIST_INCLUDE.vocations,
        creatures: HUNT_LIST_INCLUDE.creatures,
      },
      orderBy: { name: 'asc' },
    });

    return hunts.map((hunt) => ({
      id: hunt.id,
      name: hunt.name,
      slug: hunt.slug,
      location: hunt.location,
      subLocation: hunt.subLocation,
      difficulty: hunt.difficulty,
      respawn: hunt.respawn,
      heroImage: hunt.heroImage,
      mapImage: hunt.mapImage,
      vocations: hunt.vocations,
      creatures: hunt.creatures.map((item) => ({
        id: item.creature.id,
        name: item.creature.name,
        slug: item.creature.slug,
        image: item.creature.image,
        isPrimary: item.isPrimary,
        recommendedCharm: item.recommendedCharm,
      })),
      creatureCount: hunt.creatures.length,
    }));
  }

  async findBySlug(slug: string) {
    const hunt = await this.prisma.hunt.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        subLocation: true,
        difficulty: true,
        respawn: true,
        description: true,
        heroImage: true,
        mapImage: true,
        vocations: HUNT_DETAIL_INCLUDE.vocations,
        creatures: HUNT_DETAIL_INCLUDE.creatures,
        loot: HUNT_DETAIL_INCLUDE.loot,
        videos: HUNT_DETAIL_INCLUDE.videos,
      },
    });

    if (!hunt) {
      throw new NotFoundException('Hunt not found');
    }

    return {
      id: hunt.id,
      name: hunt.name,
      slug: hunt.slug,
      location: hunt.location,
      subLocation: hunt.subLocation,
      difficulty: hunt.difficulty,
      respawn: hunt.respawn,
      description: hunt.description,
      heroImage: hunt.heroImage,
      mapImage: hunt.mapImage,
      vocations: hunt.vocations,
      creatures: hunt.creatures.map((item) => ({
        id: item.id,
        isPrimary: item.isPrimary,
        quantity: item.quantity,
        recommendedCharm: item.recommendedCharm,
        damageType: item.damageType,
        notes: item.notes,
        creature: {
          id: item.creature.id,
          name: item.creature.name,
          slug: item.creature.slug,
          image: item.creature.image,
          hp: item.creature.hp,
          experience: item.creature.experience,
          difficulty: item.creature.difficulty,
          youtubeUrl: item.creature.youtubeUrl,
          elements: item.creature.elements,
        },
      })),
      loot: hunt.loot,
      videos: hunt.videos,
    };
  }

  private listWhere(query: ListHuntsQueryDto): Prisma.HuntWhereInput {
    const where: Prisma.HuntWhereInput = { isActive: true };
    const location = query.location?.trim();

    if (query.difficulty) {
      where.difficulty = query.difficulty;
    }
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }
    if (query.vocation || query.level != null) {
      const vocationWhere: Prisma.HuntVocationWhereInput = {};
      if (query.vocation) {
        vocationWhere.vocation = query.vocation;
      }
      if (query.level != null) {
        vocationWhere.levelMin = { lte: query.level };
        vocationWhere.OR = [
          { levelMax: null },
          { levelMax: { gte: query.level } },
        ];
      }
      where.vocations = { some: vocationWhere };
    }

    return where;
  }
}
