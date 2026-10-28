import type { RewardCatalogItem, RewardMission } from "../services/api/rewards";

const SUPPORTED_EVENTS = new Set(["FORUM_TOPIC_CREATED", "FORUM_COMMENT_CREATED"]);
const AD_MISSION_PATTERN = /an[uú]ncios?|advertis|rewarded|\bads?\b|propaganda/i;

const MISSION_ART: Record<string, string> = {
  missionExploration: "mission-exploracao.png",
  missionBestiary: "mission-bestiario.png",
  missionForum: "mission-forum.png",
  missionHunts: "mission-hunts.png",
  exploration: "exploracao.png",
  bestiary: "bestiario.png",
  community: "comunidade.png",
  hunt: "hunt.png",
  recruitment: "recrutamento.png",
  promotion: "divulgacao.png",
  knowledge: "conhecimento.png",
  music: "musica.png",
  mission_exploracao: "mission-exploracao.png",
  mission_bestiario: "mission-bestiario.png",
  mission_forum: "mission-forum.png",
  mission_hunts: "mission-hunts.png",
};

const CATEGORY_ART: Record<string, string> = {
  EXPLORATION: "mission-exploracao.png",
  BESTIARY: "mission-bestiario.png",
  COMMUNITY: "mission-forum.png",
  HUNT: "mission-hunts.png",
  RECRUITMENT: "recrutamento.png",
  PROMOTION: "divulgacao.png",
  KNOWLEDGE: "conhecimento.png",
  MUSIC: "musica.png",
};

const CATALOG_ART: Record<string, string> = {
  tc125: "tc-125.png",
  tc250: "tc-250.png",
  rc500: "rc-500.png",
  rc1000: "rc-1000.png",
  ferumbrasHat: "ferumbras-hat.png",
  gold1: "gold-1.png",
  gold5: "gold-5.png",
  diamond1: "diamond-1.png",
  diamond3: "diamond-3.png",
};

export function formatRewardAmount(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("pt-BR");
}

export function isPlayableRewardMission(mission: Pick<RewardMission, "eventType" | "title" | "description" | "category">) {
  if (!mission.eventType || !SUPPORTED_EVENTS.has(mission.eventType)) return false;
  const text = [mission.title, mission.description, mission.category, mission.eventType].filter(Boolean).join(" ");
  return !AD_MISSION_PATTERN.test(text);
}

export function missionArtFile(mission: Pick<RewardMission, "imageKey" | "category">) {
  const key = mission.imageKey?.trim();
  if (key && MISSION_ART[key]) return MISSION_ART[key];
  if (key && CATALOG_ART[key]) return CATALOG_ART[key];
  return CATEGORY_ART[mission.category] ?? null;
}

export function catalogArtFile(item: Pick<RewardCatalogItem, "imageKey">) {
  const key = item.imageKey?.trim();
  return key && CATALOG_ART[key] ? CATALOG_ART[key] : null;
}

export function goldArtFile(amount: number) {
  if (amount === 1) return "gold-1.png";
  if (amount === 5) return "gold-5.png";
  return null;
}

export function progressPercent(current: number, target: number) {
  const goal = Number(target);
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  const done = Number(current);
  if (!Number.isFinite(done) || done <= 0) return 0;
  return Math.min(100, (done / goal) * 100);
}

export function affordancePercent(balance: number, price: number, priceConfigured: boolean) {
  const cost = Number(price);
  const have = Number(balance);
  if (!priceConfigured || !Number.isFinite(cost) || cost <= 0) return null;
  if (!Number.isFinite(have) || have <= 0) return 0;
  return Math.min(100, Math.round((have / cost) * 100));
}

export type DiamondOffer = {
  amount: 1 | 3;
  enabled: boolean;
  goldCost: number | null;
};

export function diamondOffers(conversion?: {
  enabled?: boolean;
  rate?: { goldCost: number; diamondGranted: number } | null;
} | null): DiamondOffer[] {
  const rate = conversion?.rate;
  const goldCost = Number(rate?.goldCost);
  const granted = Number(rate?.diamondGranted);
  const enabled = Boolean(
    conversion?.enabled && Number.isFinite(goldCost) && goldCost > 0 && Number.isFinite(granted) && granted > 0,
  );

  return ([1, 3] as const).map((amount) => {
    if (!enabled || amount % granted !== 0) {
      return { amount, enabled: false, goldCost: null };
    }
    return { amount, enabled: true, goldCost: (amount / granted) * goldCost };
  });
}

export function formatRenewal(periodEnd: string | number | Date | null | undefined, now: number | Date = Date.now()) {
  if (periodEnd == null) return null;
  const end = periodEnd instanceof Date ? periodEnd.getTime() : new Date(periodEnd).getTime();
  const start = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  const diff = end - start;
  if (diff <= 0) return "0m";
  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

const ACTION_MESSAGES: Record<string, string> = {
  "Insufficient points": "Pontos insuficientes para esta conversão.",
  "Insufficient gold": "Gold insuficiente para este resgate.",
  "Insufficient diamond": "Diamond insuficiente para este resgate.",
  "Gold to Diamond conversion is not configured": "A taxa Gold → Diamond ainda não foi publicada.",
  "Reward price is not configured": "O preço deste item ainda não foi publicado.",
  "Reward is inactive": "Este item não está disponível.",
  "Reward not found": "Recompensa não encontrada.",
};

export function rewardsActionMessage(message: string) {
  return ACTION_MESSAGES[message] ?? message;
}
