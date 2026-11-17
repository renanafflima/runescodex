import { MISSION_ROLES, REWARD_EVENTS } from './rewards.constants';
import { isImplementedRewardEvent } from './rewards.events';

export type CatalogPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type MissionCatalogDef = {
  catalogKey: string;
  title: string;
  description: string;
  category:
    | 'COMMUNITY'
    | 'BESTIARY'
    | 'HUNT'
    | 'EXPLORATION'
    | 'PROMOTION'
    | 'KNOWLEDGE'
    | 'RECRUITMENT'
    | 'MUSIC';
  pillar: string;
  role: string;
  eventType: string;
  imageKey: string;
  variants: Array<{
    period: CatalogPeriod;
    target: number;
    pointsReward: number;
  }>;
};

/** 20 pool mission families × 3 periods + 3 fixed system missions. */
export const MISSION_CATALOG_V2: MissionCatalogDef[] = [
  {
    catalogKey: 'TAVERN_VOICE',
    title: 'Voz da Taverna',
    description: 'Comente em tópicos ou guias da comunidade.',
    category: 'COMMUNITY',
    pillar: 'COMMUNITY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.FORUM_COMMENT_CREATED,
    imageKey: 'missionForum',
    variants: [
      { period: 'DAILY', target: 2, pointsReward: 90 },
      { period: 'WEEKLY', target: 10, pointsReward: 300 },
      { period: 'MONTHLY', target: 35, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'ADVENTURER_HELPER',
    title: 'Ajudante de Aventureiros',
    description: 'Curta guias ou respostas úteis da comunidade.',
    category: 'COMMUNITY',
    pillar: 'COMMUNITY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.COMMUNITY_CONTENT_LIKED,
    imageKey: 'missionForum',
    variants: [
      { period: 'DAILY', target: 3, pointsReward: 80 },
      { period: 'WEEKLY', target: 15, pointsReward: 280 },
      { period: 'MONTHLY', target: 50, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'KINGDOM_SCRIBE',
    title: 'Escriba do Reino',
    description: 'Crie um tópico, dúvida ou dica no fórum.',
    category: 'COMMUNITY',
    pillar: 'COMMUNITY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.FORUM_TOPIC_CREATED,
    imageKey: 'missionForum',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 100 },
      { period: 'WEEKLY', target: 3, pointsReward: 320 },
      { period: 'MONTHLY', target: 10, pointsReward: 1100 },
    ],
  },
  {
    catalogKey: 'GUIDE_MASTER',
    title: 'Mestre dos Guias',
    description: 'Publique um guia de Charm ou uma rotação de Bosses.',
    category: 'COMMUNITY',
    pillar: 'COMMUNITY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.GUIDE_PUBLISHED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 110 },
      { period: 'WEEKLY', target: 2, pointsReward: 350 },
      { period: 'MONTHLY', target: 5, pointsReward: 1200 },
    ],
  },
  {
    catalogKey: 'GUILD_RECRUITER',
    title: 'Recrutador de Guilda',
    description: 'Use o botão de compartilhar em um guia, Hunt ou Boss.',
    category: 'PROMOTION',
    pillar: 'COMMUNITY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.SHARE_LINK_CLICKED,
    imageKey: 'promotion',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 4, pointsReward: 300 },
      { period: 'MONTHLY', target: 12, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'BESTIARY_SCHOLAR',
    title: 'Estudioso do Bestiário',
    description: 'Visualize páginas de criaturas distintas.',
    category: 'BESTIARY',
    pillar: 'BESTIARY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.CREATURE_VIEWED,
    imageKey: 'missionBestiary',
    variants: [
      { period: 'DAILY', target: 5, pointsReward: 80 },
      { period: 'WEEKLY', target: 25, pointsReward: 280 },
      { period: 'MONTHLY', target: 100, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'CHARM_HUNTER',
    title: 'Caçador de Charm Points',
    description: 'Marque criaturas como concluídas no tracker de Charms.',
    category: 'BESTIARY',
    pillar: 'BESTIARY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.CHARM_CREATURE_COMPLETED,
    imageKey: 'missionBestiary',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 100 },
      { period: 'WEEKLY', target: 5, pointsReward: 320 },
      { period: 'MONTHLY', target: 20, pointsReward: 1100 },
    ],
  },
  {
    catalogKey: 'RUNE_ALCHEMIST',
    title: 'Alquimista de Runas',
    description: 'Salve ou publique uma build/guia de Charms.',
    category: 'BESTIARY',
    pillar: 'BESTIARY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.CHARM_BUILD_SAVED,
    imageKey: 'missionBestiary',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 4, pointsReward: 300 },
      { period: 'MONTHLY', target: 15, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'RAPID_TRACKER',
    title: 'Rastreador de Rapid Respawn',
    description: 'Consulte ou filtre criaturas por categoria ou dificuldade.',
    category: 'BESTIARY',
    pillar: 'BESTIARY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.BESTIARY_FILTER_USED,
    imageKey: 'missionBestiary',
    variants: [
      { period: 'DAILY', target: 3, pointsReward: 80 },
      { period: 'WEEKLY', target: 15, pointsReward: 280 },
      { period: 'MONTHLY', target: 50, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'LOOT_COLLECTOR',
    title: 'Colecionador de Loots',
    description: 'Verifique itens ou drops na enciclopédia.',
    category: 'BESTIARY',
    pillar: 'BESTIARY',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.LOOT_ITEM_VIEWED,
    imageKey: 'missionBestiary',
    variants: [
      { period: 'DAILY', target: 3, pointsReward: 80 },
      { period: 'WEEKLY', target: 15, pointsReward: 280 },
      { period: 'MONTHLY', target: 50, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'BOSS_SLAYER',
    title: 'Carrasco de Bosses',
    description: 'Registre um Boss derrotado no tracker ou checklist.',
    category: 'HUNT',
    pillar: 'BOSSES',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.BOSS_DEFEATED_RECORDED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 7, pointsReward: 300 },
      { period: 'MONTHLY', target: 25, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'ROTATION_STRATEGIST',
    title: 'Estrategista de Rotação',
    description: 'Crie ou edite uma lista de rotação de Bosses.',
    category: 'HUNT',
    pillar: 'BOSSES',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.ROTATION_EDITED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 100 },
      { period: 'WEEKLY', target: 3, pointsReward: 320 },
      { period: 'MONTHLY', target: 10, pointsReward: 1050 },
    ],
  },
  {
    catalogKey: 'COOLDOWN_WATCHER',
    title: 'Vigia do Cooldown',
    description: 'Acesse a aba Bosstiary ou consulte timers de Bosses.',
    category: 'HUNT',
    pillar: 'BOSSES',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.BOSSTIARY_OPENED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 80 },
      { period: 'WEEKLY', target: 5, pointsReward: 280 },
      { period: 'MONTHLY', target: 20, pointsReward: 900 },
    ],
  },
  {
    catalogKey: 'ARCHDEMON_HUNTER',
    title: 'Caçador de Arquidemônios',
    description: 'Consulte detalhes de Bosses Nemesis ou Archfoe.',
    category: 'HUNT',
    pillar: 'BOSSES',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.ARCHFOE_BOSS_VIEWED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 2, pointsReward: 85 },
      { period: 'WEEKLY', target: 10, pointsReward: 290 },
      { period: 'MONTHLY', target: 35, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'LAND_EXPLORER',
    title: 'Explorador de Terras',
    description: 'Abra guias de locais de Hunt diferentes.',
    category: 'EXPLORATION',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.HUNT_VIEWED,
    imageKey: 'missionExploration',
    variants: [
      { period: 'DAILY', target: 3, pointsReward: 85 },
      { period: 'WEEKLY', target: 15, pointsReward: 290 },
      { period: 'MONTHLY', target: 50, pointsReward: 950 },
    ],
  },
  {
    catalogKey: 'CARTOGRAPHER',
    title: 'Cartógrafo',
    description: 'Favorite uma Hunt no planner pessoal.',
    category: 'EXPLORATION',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.HUNT_FAVORITED,
    imageKey: 'missionExploration',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 4, pointsReward: 300 },
      { period: 'MONTHLY', target: 12, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'DAILY_ORACLE',
    title: 'Oráculo Diário',
    description: 'Consulte Daily Reward Shrine ou criaturas boosted do dia.',
    category: 'KNOWLEDGE',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.DAILY_INFO_VIEWED,
    imageKey: 'knowledge',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 80 },
      { period: 'WEEKLY', target: 5, pointsReward: 280 },
      { period: 'MONTHLY', target: 20, pointsReward: 900 },
    ],
  },
  {
    catalogKey: 'SUPPLY_MERCHANT',
    title: 'Mercador de Suprimentos',
    description: 'Use calculadora de imbuements, stamina, share EXP ou loot split.',
    category: 'KNOWLEDGE',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.TOOL_CALCULATION_USED,
    imageKey: 'knowledge',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 5, pointsReward: 300 },
      { period: 'MONTHLY', target: 18, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'FIELD_RATER',
    title: 'Avaliador de Campo',
    description: 'Avalie ou dê nota em Hunt ou guia da comunidade.',
    category: 'HUNT',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.CONTENT_RATED,
    imageKey: 'missionHunts',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 5, pointsReward: 300 },
      { period: 'MONTHLY', target: 15, pointsReward: 1000 },
    ],
  },
  {
    catalogKey: 'MERCHANT_HERALD',
    title: 'Arauto dos Mercadores',
    description: 'Abra um banner promocional interno (TriTech, TC, Anuncie Aqui).',
    category: 'PROMOTION',
    pillar: 'TOOLS',
    role: MISSION_ROLES.POOL,
    eventType: REWARD_EVENTS.PROMO_BANNER_OPENED,
    imageKey: 'promotion',
    variants: [
      { period: 'DAILY', target: 1, pointsReward: 90 },
      { period: 'WEEKLY', target: 4, pointsReward: 300 },
      { period: 'MONTHLY', target: 12, pointsReward: 1000 },
    ],
  },
];

export const FIXED_MISSIONS_V2: Array<{
  catalogKey: string;
  title: string;
  description: string;
  category: MissionCatalogDef['category'];
  pillar: string;
  role: string;
  eventType: string;
  imageKey: string;
  period: CatalogPeriod;
  target: number;
  pointsReward: number;
}> = [
  {
    catalogKey: 'TRIBUTE_TO_GODS',
    title: 'Tributo aos Deuses',
    description: 'Assista a 3 anúncios Rewarded verificados (Web).',
    category: 'PROMOTION',
    pillar: 'SYSTEM',
    role: MISSION_ROLES.FIXED_ADS,
    eventType: REWARD_EVENTS.WATCH_AD,
    imageKey: 'promotion',
    period: 'DAILY',
    target: 3,
    pointsReward: 120,
  },
  {
    catalogKey: 'UNBREAKABLE_DEVOTION',
    title: 'Devoção Inabalável',
    description:
      'Complete as três missões diárias em cada um dos sete dias da semana UTC.',
    category: 'COMMUNITY',
    pillar: 'SYSTEM',
    role: MISSION_ROLES.FIXED_WEEKLY_STREAK,
    eventType: REWARD_EVENTS.DAILY_ALL_COMPLETED,
    imageKey: 'missionForum',
    period: 'WEEKLY',
    target: 7,
    pointsReward: 400,
  },
  {
    catalogKey: 'CODEX_LEGEND',
    title: 'Lenda do Codex',
    description:
      'Complete as duas missões semanais em quatro ciclos semanais UTC do mês.',
    category: 'COMMUNITY',
    pillar: 'SYSTEM',
    role: MISSION_ROLES.FIXED_MONTHLY_STREAK,
    eventType: REWARD_EVENTS.WEEKLY_ALL_COMPLETED,
    imageKey: 'missionForum',
    period: 'MONTHLY',
    target: 4,
    pointsReward: 1500,
  },
];

export function catalogRowsForSeed() {
  const rows: Array<{
    catalogKey: string;
    title: string;
    description: string;
    category: string;
    pillar: string;
    role: string;
    eventType: string;
    imageKey: string;
    period: CatalogPeriod;
    target: number;
    pointsReward: number;
    active: boolean;
    eventImplemented: boolean;
  }> = [];

  for (const def of MISSION_CATALOG_V2) {
    const implemented = isImplementedRewardEvent(def.eventType);
    for (const variant of def.variants) {
      rows.push({
        catalogKey: def.catalogKey,
        title: def.title,
        description: def.description,
        category: def.category,
        pillar: def.pillar,
        role: def.role,
        eventType: def.eventType,
        imageKey: def.imageKey,
        period: variant.period,
        target: variant.target,
        pointsReward: variant.pointsReward,
        active: true,
        eventImplemented: implemented,
      });
    }
  }

  for (const fixed of FIXED_MISSIONS_V2) {
    rows.push({
      ...fixed,
      active: true,
      eventImplemented: isImplementedRewardEvent(fixed.eventType),
    });
  }

  return rows;
}