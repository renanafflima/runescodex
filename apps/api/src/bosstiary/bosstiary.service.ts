import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  Prisma,
} from '../../generated/prisma/client.js';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOSSTIARY_ORIGIN_CITIES,
  BOSSTIARY_TIME_OPTIONS,
} from './bosstiary.constants';
import { FindRotationsQueryDto } from './dto/find-rotations.dto';
import { ListBosstiaryQueryDto } from './dto/list-bosstiary-query.dto';
import { planBosstiaryRotations, type PlannerBoss } from './rotation-planner';

const BOSS_INCLUDE = {
  vocations: { select: { vocation: true } },
} as const;

@Injectable()
export class BosstiaryService {
  constructor(private readonly prisma: PrismaService) {}

  meta() {
    return {
      timeOptions: BOSSTIARY_TIME_OPTIONS.map((minutes) => ({
        minutes,
        label: timeLabel(minutes),
      })),
      originCities: [...BOSSTIARY_ORIGIN_CITIES],
      vocations: [
        { code: 'EK', label: 'Knight' },
        { code: 'RP', label: 'Paladin' },
        { code: 'MS', label: 'Sorcerer' },
        { code: 'ED', label: 'Druid' },
        { code: 'EM', label: 'Monk' },
      ],
      huntModes: [
        { code: BosstiaryHuntMode.SOLO, label: 'Solo' },
        { code: BosstiaryHuntMode.PARTY, label: 'Grupo' },
      ],
      pendingData: [
        'Perfis revisados de bosses (localização, acesso, cooldown, tempo de combate, Boss Points).',
        'Tempos de deslocamento verificados entre cidades.',
        'Rotações curatoriais opcionais.',
        'Classificação editorial Solo/Grupo e faixa de level.',
      ],
    };
  }

  async findAll(query: ListBosstiaryQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = this.listWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.bosstiaryBoss.count({ where }),
      this.prisma.bosstiaryBoss.findMany({
        where,
        include: BOSS_INCLUDE,
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows.map((row) => this.serializeBoss(row)), total, page, limit);
  }

  async findBySlug(slug: string) {
    const row = await this.prisma.bosstiaryBoss.findFirst({
      where: { slug, isActive: true },
      include: BOSS_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Boss não encontrado no Bosstiário revisado.');
    }
    return this.serializeBoss(row);
  }

  async findRotations(query: FindRotationsQueryDto) {
    const [bosses, travel] = await Promise.all([
      this.prisma.bosstiaryBoss.findMany({
        where: { isActive: true, huntMode: query.huntMode },
        include: BOSS_INCLUDE,
      }),
      this.prisma.bosstiaryTravelEdge.findMany(),
    ]);
    return planBosstiaryRotations({
      availableMinutes: query.availableMinutes,
      level: query.level,
      huntMode: query.huntMode,
      vocation: query.vocation,
      originCity: query.originCity,
      bosses: bosses.map((row) => this.toPlannerBoss(row)),
      travel: travel.map((edge) => ({
        fromCity: edge.fromCity,
        toCity: edge.toCity,
        minutes: edge.minutes,
      })),
    });
  }

  private listWhere(query: ListBosstiaryQueryDto): Prisma.BosstiaryBossWhereInput {
    const search = query.search?.trim();
    const and: Prisma.BosstiaryBossWhereInput[] = [];
    if (query.recommendedLevel) {
      and.push({
        OR: [
          { recommendedLevelSolo: query.recommendedLevel },
          { recommendedLevelParty: query.recommendedLevel },
        ],
      });
    }
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { locationName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    return {
      isActive: true,
      huntMode: query.huntMode,
      difficulty: query.difficulty,
      officialCategory: query.officialCategory,
      ...(and.length ? { AND: and } : {}),
    };
  }

  private toPlannerBoss(row: {
    slug: string;
    name: string;
    huntMode: BosstiaryHuntMode | null;
    recommendedLevelSolo: number | null;
    recommendedLevelParty: number | null;
    originCity: string | null;
    locationName: string | null;
    locationRegion: string | null;
    accessStatus: BosstiaryAccessStatus;
    accessRequirements: string | null;
    cooldownSeconds: number | null;
    estimatedCombatMinutes: number | null;
    bossPoints: number | null;
    vocations: { vocation: PlannerBoss['vocations'][number] }[];
  }): PlannerBoss {
    const huntMode = row.huntMode ?? BosstiaryHuntMode.SOLO;
    return {
      slug: row.slug,
      name: row.name,
      huntMode,
      recommendedLevel:
        huntMode === BosstiaryHuntMode.PARTY
          ? row.recommendedLevelParty
          : row.recommendedLevelSolo,
      originCity: row.originCity,
      locationName: row.locationName,
      locationRegion: row.locationRegion,
      accessStatus: row.accessStatus,
      accessRequirements: row.accessRequirements,
      cooldownSeconds: row.cooldownSeconds,
      estimatedCombatMinutes: row.estimatedCombatMinutes,
      bossPoints: row.bossPoints,
      vocations: row.vocations.map((item) => item.vocation),
    };
  }

  private serializeBoss(row: {
    id: string;
    slug: string;
    name: string;
    officialCategory: string | null;
    huntMode: BosstiaryHuntMode | null;
    recommendedLevelSolo: number | null;
    recommendedLevelParty: number | null;
    difficulty: string | null;
    locationName: string | null;
    locationRegion: string | null;
    originCity: string | null;
    accessStatus: BosstiaryAccessStatus;
    accessRequirements: string | null;
    howToReach: string | null;
    cooldownSeconds: number | null;
    estimatedCombatMinutes: number | null;
    bossPoints: number | null;
    mechanics: string | null;
    strategy: string | null;
    vocations: { vocation: string }[];
  }) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      source: 'reviewed-profile' as const,
      officialCategory: row.officialCategory,
      huntMode: row.huntMode,
      recommendedLevelSolo: row.recommendedLevelSolo,
      recommendedLevelParty: row.recommendedLevelParty,
      difficulty: row.difficulty,
      locationName: row.locationName,
      locationRegion: row.locationRegion,
      originCity: row.originCity,
      accessStatus: row.accessStatus,
      accessRequirements: row.accessRequirements,
      howToReach: row.howToReach,
      cooldownSeconds: row.cooldownSeconds,
      estimatedCombatMinutes: row.estimatedCombatMinutes,
      bossPoints: row.bossPoints,
      mechanics: row.mechanics,
      strategy: row.strategy,
      vocations: row.vocations.map((item) => item.vocation),
      facts: {
        officialCategory: fact(row.officialCategory, 'official'),
        huntMode: fact(row.huntMode, 'editorial'),
        recommendedLevelSolo: fact(row.recommendedLevelSolo, 'editorial'),
        recommendedLevelParty: fact(row.recommendedLevelParty, 'editorial'),
        difficulty: fact(row.difficulty, 'editorial'),
        locationName: fact(row.locationName, 'official'),
        cooldownSeconds: fact(row.cooldownSeconds, 'official'),
        estimatedCombatMinutes: fact(row.estimatedCombatMinutes, 'estimated'),
        bossPoints: fact(row.bossPoints, 'official'),
        accessStatus: {
          value: row.accessStatus,
          kind: row.accessStatus === BosstiaryAccessStatus.UNKNOWN ? 'pending' : 'official',
        },
      },
    };
  }
}

function fact(value: unknown, kind: 'official' | 'editorial' | 'estimated') {
  return { value: value ?? null, kind: value == null ? 'pending' : kind };
}

function timeLabel(minutes: number) {
  if (minutes === 15) return 'Uma pausa rápida';
  if (minutes === 20) return 'Uma sessão curta';
  if (minutes === 30) return 'Tempo para explorar';
  return 'Uma hora de farm';
}
