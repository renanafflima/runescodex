import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { publicHttpsUrl } from '../common/https-url';
import { pageResult, resolvePage } from '../common/pagination';
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

const HUNT_CREATURE_ORDER = [
  { isPrimary: 'desc' as const },
  { createdAt: 'asc' as const },
];

const HUNT_LIST_INCLUDE = {
  vocations: {
    select: VOCATION_SELECT,
    orderBy: { vocation: 'asc' as const },
  },
  creatures: {
    select: {
      isPrimary: true,
      recommendedCharm: true,
      creatureId: true,
    },
    orderBy: HUNT_CREATURE_ORDER,
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
      creatureId: true,
    },
    orderBy: HUNT_CREATURE_ORDER,
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
    const where = this.listWhere(query);
    const { page, limit, skip } = resolvePage(query);
    const [total, hunts] = await Promise.all([
      this.prisma.hunt.count({ where }),
      this.prisma.hunt.findMany({
        where,
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
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const creaturesById = await this.listCreaturesById(
      hunts.flatMap((hunt) => hunt.creatures.map((item) => item.creatureId)),
    );

    return pageResult(
      hunts.map((hunt) => {
        const creatures = hunt.creatures.flatMap((item) => {
          const creature = creaturesById.get(item.creatureId);
          if (!creature) {
            return [];
          }
          return [
            {
              id: creature.id,
              name: creature.name,
              slug: creature.slug,
              image: creature.image,
              isPrimary: item.isPrimary,
              recommendedCharm: item.recommendedCharm,
            },
          ];
        });
        return {
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
          creatures,
          creatureCount: creatures.length,
        };
      }),
      total,
      page,
      limit,
    );
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

    const creaturesById = await this.detailCreaturesById(
      hunt.creatures.map((item) => item.creatureId),
    );

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
      creatures: hunt.creatures.flatMap((item) => {
        const creature = creaturesById.get(item.creatureId);
        if (!creature) {
          return [];
        }
        return [
          {
            id: item.id,
            isPrimary: item.isPrimary,
            quantity: item.quantity,
            recommendedCharm: item.recommendedCharm,
            damageType: item.damageType,
            notes: item.notes,
            creature: {
              id: creature.id,
              name: creature.name,
              slug: creature.slug,
              image: creature.image,
              hp: creature.hp,
              experience: creature.experience,
              difficulty: creature.difficulty,
              youtubeUrl: publicHttpsUrl(creature.youtubeUrl),
              elements: creature.elements,
            },
          },
        ];
      }),
      loot: hunt.loot,
      videos: hunt.videos.flatMap((video) => {
        const url = publicHttpsUrl(video.url);
        if (!url) {
          return [];
        }
        return [{ ...video, url }];
      }),
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
    if (query.creature) {
      where.creatures = {
        some: {
          creature: { slug: query.creature, isActive: true },
        },
      };
    }
    const search = query.search?.trim();
    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { subLocation: { contains: search, mode: 'insensitive' } },
            {
              creatures: {
                some: {
                  creature: {
                    name: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        },
      ];
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

  private async listCreaturesById(creatureIds: string[]) {
    const ids = [...new Set(creatureIds)];
    if (ids.length === 0) {
      return new Map<
        string,
        Prisma.CreatureGetPayload<{ select: typeof CREATURE_SUMMARY_SELECT }>
      >();
    }
    const creatures = await this.prisma.creature.findMany({
      where: { id: { in: ids } },
      select: CREATURE_SUMMARY_SELECT,
    });
    return new Map(creatures.map((creature) => [creature.id, creature]));
  }

  private async detailCreaturesById(creatureIds: string[]) {
    const ids = [...new Set(creatureIds)];
    const select = {
      ...CREATURE_SUMMARY_SELECT,
      hp: true,
      experience: true,
      difficulty: true,
      youtubeUrl: true,
      elements: {
        select: ELEMENT_SELECT,
        orderBy: { modifier: 'desc' as const },
      },
    } satisfies Prisma.CreatureSelect;
    if (ids.length === 0) {
      return new Map<
        string,
        Prisma.CreatureGetPayload<{ select: typeof select }>
      >();
    }
    const creatures = await this.prisma.creature.findMany({
      where: { id: { in: ids } },
      select,
    });
    return new Map(creatures.map((creature) => [creature.id, creature]));
  }
}
