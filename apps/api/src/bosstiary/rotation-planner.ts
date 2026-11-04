import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  BosstiaryRotationKind,
  Vocation,
} from '../../generated/prisma/client.js';

export type PlannerBoss = {
  slug: string;
  name: string;
  huntMode: BosstiaryHuntMode;
  recommendedLevel: number | null;
  originCity: string | null;
  locationName: string | null;
  locationRegion: string | null;
  accessStatus: BosstiaryAccessStatus;
  accessRequirements: string | null;
  cooldownSeconds: number | null;
  estimatedCombatMinutes: number | null;
  bossPoints: number | null;
  vocations: Vocation[];
};

export type PlannerTravelEdge = {
  fromCity: string;
  toCity: string;
  minutes: number;
};

export type PlannerStop = {
  position: number;
  slug: string;
  name: string;
  locationName: string | null;
  locationRegion: string | null;
  originCity: string;
  combatMinutes: number;
  travelMinutes: number;
  travelKnown: true;
  cooldownSeconds: number | null;
  accessRequirements: string | null;
  bossPoints: number | null;
  recommendedLevel: number;
};

export type PlannedRotation = {
  id: string;
  name: string;
  kind: BosstiaryRotationKind;
  huntMode: BosstiaryHuntMode;
  originCity: string;
  recommendedLevel: number | null;
  totalCombatMinutes: number;
  totalTravelMinutes: number;
  totalMinutes: number;
  bossCount: number;
  bossPointsTotal: number | null;
  pointsPerMinute: number | null;
  reason: string;
  stops: PlannerStop[];
};

export type PlannerInput = {
  availableMinutes: number;
  level: number;
  huntMode: BosstiaryHuntMode;
  vocation: Vocation;
  originCity: string;
  bosses: PlannerBoss[];
  travel: PlannerTravelEdge[];
};

export type PlannerResult = {
  items: PlannedRotation[];
  dataGaps: string[];
  emptyReason: string | null;
};

type EligibleBoss = PlannerBoss & {
  recommendedLevel: number;
  originCity: string;
  estimatedCombatMinutes: number;
};

const KIND_REASON: Record<BosstiaryRotationKind, string> = {
  EXPRESS:
    'Rota expressa — proximidade: bosses com deslocamento conhecido a partir da sua cidade, cabendo no tempo disponível. O level é recomendação editorial do RuneCodex, não requisito oficial do Tibia.',
  PROGRESSION:
    'Rota de progressão: melhor aproveitamento de Boss Points no tempo disponível, com pontos e tempos verificados. O level é recomendação editorial do RuneCodex, não requisito oficial do Tibia.',
  ALTERNATIVE:
    'Rota alternativa: outra sequência válida com deslocamento conhecido que também cabe no período. O level é recomendação editorial do RuneCodex, não requisito oficial do Tibia.',
};

export function travelMinutesBetween(
  fromCity: string,
  toCity: string,
  travel: PlannerTravelEdge[],
): number | null {
  if (fromCity === toCity) return 0;
  const direct = travel.find(
    (edge) => edge.fromCity === fromCity && edge.toCity === toCity,
  );
  if (direct) return direct.minutes;
  const reverse = travel.find(
    (edge) => edge.fromCity === toCity && edge.toCity === fromCity,
  );
  return reverse ? reverse.minutes : null;
}

export function isEligibleForRotation(
  boss: PlannerBoss,
  input: Pick<PlannerInput, 'level' | 'huntMode' | 'vocation'>,
): boss is EligibleBoss {
  if (boss.huntMode !== input.huntMode) return false;
  if (boss.recommendedLevel == null) return false;
  if (input.level < boss.recommendedLevel) return false;
  if (boss.vocations.length > 0 && !boss.vocations.includes(input.vocation)) {
    return false;
  }
  if (boss.accessStatus !== BosstiaryAccessStatus.NONE) return false;
  if (boss.estimatedCombatMinutes == null || boss.estimatedCombatMinutes <= 0) {
    return false;
  }
  if (!boss.originCity) return false;
  return true;
}

function packRoute(
  startCity: string,
  availableMinutes: number,
  bosses: EligibleBoss[],
  travel: PlannerTravelEdge[],
  prefer: 'travel' | 'points',
): EligibleBoss[] {
  const remaining = [...bosses];
  const picked: EligibleBoss[] = [];
  let city = startCity;
  let used = 0;

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const hop = travelMinutesBetween(city, candidate.originCity, travel);
      if (hop == null) continue;
      const cost = hop + candidate.estimatedCombatMinutes;
      if (used + cost > availableMinutes) continue;
      const score =
        prefer === 'points'
          ? hop - (candidate.bossPoints ?? 0) * 10
          : hop * 10 + candidate.estimatedCombatMinutes;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    const [next] = remaining.splice(bestIndex, 1);
    const hop = travelMinutesBetween(city, next.originCity, travel) ?? 0;
    picked.push(next);
    used += hop + next.estimatedCombatMinutes;
    city = next.originCity;
  }

  return picked;
}

function toStops(
  bosses: EligibleBoss[],
  startCity: string,
  travel: PlannerTravelEdge[],
): PlannerStop[] | null {
  const stops: PlannerStop[] = [];
  let city = startCity;
  for (let index = 0; index < bosses.length; index += 1) {
    const boss = bosses[index];
    const hop = travelMinutesBetween(city, boss.originCity, travel);
    if (hop == null) return null;
    stops.push({
      position: index + 1,
      slug: boss.slug,
      name: boss.name,
      locationName: boss.locationName,
      locationRegion: boss.locationRegion,
      originCity: boss.originCity,
      combatMinutes: boss.estimatedCombatMinutes,
      travelMinutes: hop,
      travelKnown: true,
      cooldownSeconds: boss.cooldownSeconds,
      accessRequirements: boss.accessRequirements,
      bossPoints: boss.bossPoints,
      recommendedLevel: boss.recommendedLevel,
    });
    city = boss.originCity;
  }
  return stops;
}

function rotationName(kind: BosstiaryRotationKind) {
  if (kind === BosstiaryRotationKind.EXPRESS) return 'Rota expressa — proximidade';
  if (kind === BosstiaryRotationKind.PROGRESSION) return 'Rota de progressão';
  return 'Rota alternativa';
}

function summarize(
  kind: BosstiaryRotationKind,
  huntMode: BosstiaryHuntMode,
  originCity: string,
  stops: PlannerStop[],
): PlannedRotation {
  const totalCombatMinutes = stops.reduce((sum, stop) => sum + stop.combatMinutes, 0);
  const totalTravelMinutes = stops.reduce((sum, stop) => sum + stop.travelMinutes, 0);
  const totalMinutes = totalCombatMinutes + totalTravelMinutes;
  const points = stops.every((stop) => stop.bossPoints != null)
    ? stops.reduce((sum, stop) => sum + (stop.bossPoints ?? 0), 0)
    : null;
  const levels = stops.map((stop) => stop.recommendedLevel);
  return {
    id: `${kind.toLowerCase()}-${stops.map((stop) => stop.slug).join('-')}`,
    name: rotationName(kind),
    kind,
    huntMode,
    originCity,
    recommendedLevel: levels.length ? Math.max(...levels) : null,
    totalCombatMinutes,
    totalTravelMinutes,
    totalMinutes,
    bossCount: stops.length,
    bossPointsTotal: points,
    pointsPerMinute:
      points != null && totalMinutes > 0 ? Number((points / totalMinutes).toFixed(2)) : null,
    reason: KIND_REASON[kind],
    stops,
  };
}

function sameRoute(left: EligibleBoss[], right: EligibleBoss[]) {
  return left.length === right.length && left.every((boss, index) => boss.slug === right[index]?.slug);
}

function collectGaps(bosses: PlannerBoss[], travel: PlannerTravelEdge[]) {
  const gaps = new Set<string>();
  if (bosses.length === 0) {
    gaps.add(
      'Nenhum perfil de boss revisado está cadastrado. O planejador não usa a lista de candidatos da TibiaWiki.',
    );
  }
  if (travel.length === 0) {
    gaps.add(
      'Não há tempos de deslocamento verificados entre cidades. Rotas só consideram bosses na mesma cidade de origem até esses dados existirem.',
    );
  }
  if (bosses.some((boss) => boss.estimatedCombatMinutes == null)) {
    gaps.add('Tempo de combate ainda não revisado em um ou mais bosses.');
  }
  if (bosses.some((boss) => boss.accessStatus !== BosstiaryAccessStatus.NONE)) {
    gaps.add(
      'Bosses sem acesso confirmado como desnecessário ficam de fora. O planejador não assume que o jogador possui requisitos.',
    );
  }
  if (bosses.some((boss) => boss.recommendedLevel == null)) {
    gaps.add(
      'Recomendação editorial de level ainda pendente. Sem ela o boss não entra em rotações automáticas.',
    );
  }
  if (bosses.some((boss) => boss.bossPoints == null)) {
    gaps.add(
      'Boss Points ausentes: a eficiência em pontos por minuto só aparece quando todos os bosses da rota têm pontos verificados.',
    );
  }
  if (bosses.some((boss) => boss.cooldownSeconds == null)) {
    gaps.add(
      'Cooldown oficial ainda pendente em alguns bosses. O cooldown nunca é usado como tempo de combate.',
    );
  }
  return [...gaps];
}

export function planBosstiaryRotations(input: PlannerInput): PlannerResult {
  const dataGaps = collectGaps(input.bosses, input.travel);
  const eligible = input.bosses.filter((boss): boss is EligibleBoss =>
    isEligibleForRotation(boss, input),
  );
  const reachable = eligible.filter(
    (boss) => travelMinutesBetween(input.originCity, boss.originCity, input.travel) != null,
  );

  if (reachable.length === 0) {
    return {
      items: [],
      dataGaps,
      emptyReason:
        eligible.length === 0
          ? 'Não há bosses revisados compatíveis com o level, a vocação, o modo de caça e o tempo informados. Candidatos sem classificação editorial, acesso conhecido e tempo de combate não entram em rotações.'
          : 'Há bosses compatíveis, mas o deslocamento até a cidade deles ainda não foi verificado a partir da origem escolhida.',
    };
  }

  const expressBosses = packRoute(
    input.originCity,
    input.availableMinutes,
    reachable,
    input.travel,
    'travel',
  );
  const progressionBosses = packRoute(
    input.originCity,
    input.availableMinutes,
    reachable.filter((boss) => boss.bossPoints != null),
    input.travel,
    'points',
  );
  const usedSlugs = new Set(expressBosses.map((boss) => boss.slug));
  const alternativeBosses = packRoute(
    input.originCity,
    input.availableMinutes,
    reachable.filter((boss) => !usedSlugs.has(boss.slug)),
    input.travel,
    'travel',
  );

  const items: PlannedRotation[] = [];
  const expressStops = toStops(expressBosses, input.originCity, input.travel);
  if (expressStops?.length) {
    items.push(summarize(BosstiaryRotationKind.EXPRESS, input.huntMode, input.originCity, expressStops));
  }
  const progressionStops = toStops(progressionBosses, input.originCity, input.travel);
  if (
    progressionStops?.length &&
    !sameRoute(progressionBosses, expressBosses) &&
    progressionStops.every((stop) => stop.bossPoints != null)
  ) {
    items.push(
      summarize(BosstiaryRotationKind.PROGRESSION, input.huntMode, input.originCity, progressionStops),
    );
  }
  const alternativeStops = toStops(alternativeBosses, input.originCity, input.travel);
  if (alternativeStops?.length) {
    items.push(
      summarize(BosstiaryRotationKind.ALTERNATIVE, input.huntMode, input.originCity, alternativeStops),
    );
  }

  return {
    items,
    dataGaps,
    emptyReason:
      items.length === 0
        ? 'Os bosses compatíveis não cabem no tempo disponível depois de somar combate e deslocamento verificados. O cooldown não é usado como duração da luta e o mesmo boss não se repete na rota.'
        : null,
  };
}
