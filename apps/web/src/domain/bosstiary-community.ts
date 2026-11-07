import type {
  CommunityDurationFilter,
  CommunityHuntMode,
  CommunityLevelFilter,
  CommunityRecommendedLevel,
  CommunityRotationCard,
  CommunityRotationSort,
} from "../services/api/community-rotations";
import { huntModeLabel } from "./bosstiary-rotations";

export type { CommunityRecommendedLevel, CommunityRotationSort };

export const COMMUNITY_LEVEL_FILTERS: Array<{ id: CommunityLevelFilter; label: string }> = [
  { id: "ALL", label: "Todos os levels" },
  { id: "300", label: "300+" },
  { id: "500", label: "500+" },
  { id: "700", label: "700+" },
  { id: "1000_PLUS", label: "1000+" },
];

export const COMMUNITY_MODE_FILTERS: Array<{ id: "ALL" | CommunityHuntMode; label: string }> = [
  { id: "ALL", label: "Solo e grupo" },
  { id: "SOLO", label: "Solo" },
  { id: "PARTY", label: "Grupo" },
];

export const COMMUNITY_DURATION_FILTERS: Array<{ id: CommunityDurationFilter; label: string }> = [
  { id: "ALL", label: "Qualquer duração" },
  { id: "15", label: "15 min" },
  { id: "30", label: "30 min" },
  { id: "60", label: "60 min" },
];

export const COMMUNITY_SORT_OPTIONS: Array<{ id: CommunityRotationSort; label: string }> = [
  { id: "RECENT", label: "Mais recentes" },
  { id: "LIKES", label: "Mais curtidas" },
  { id: "COMMENTS", label: "Mais comentadas" },
];

export const COMMUNITY_RECOMMENDED_LEVEL_OPTIONS: Array<{
  value: CommunityRecommendedLevel;
  label: string;
}> = [
  { value: "L300", label: "Level 300+" },
  { value: "L500", label: "Level 500+" },
  { value: "L700", label: "Level 700+" },
  { value: "L1000_PLUS", label: "Level 1000+" },
];

export const COMMUNITY_PLANNED_DURATIONS = [15, 30, 60] as const;

export const COMMUNITY_TITLE_MAX = 120;
export const COMMUNITY_TEXT_MAX = 4000;
export const COMMUNITY_BOSS_NOTES_MAX = 500;
export const COMMUNITY_COMMENT_MAX = 1000;

export function communityHuntModeLabel(mode: CommunityHuntMode) {
  return huntModeLabel(mode);
}

export function communityDurationLabel(minutes: number) {
  return `${minutes} min`;
}

export function communityBossSummary(card: Pick<CommunityRotationCard, "bosses">, max = 4) {
  const names = card.bosses
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((stop) => stop.name || stop.bossName || "Boss")
    .filter(Boolean);
  if (names.length <= max) return names.join(" · ");
  return `${names.slice(0, max).join(" · ")} +${names.length - max}`;
}

export function formatCommunityWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function authorLabel(name: string | null | undefined) {
  return name?.trim() || "Jogador";
}

export const COMMUNITY_ROTATION_PUBLISHED_EVENT =
  "BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED";

export function missionActivityPath(eventType: string | null | undefined): string | null {
  if (eventType === "FORUM_TOPIC_CREATED" || eventType === "FORUM_COMMENT_CREATED") {
    return "/forum";
  }
  if (eventType === COMMUNITY_ROTATION_PUBLISHED_EVENT) {
    return "/bosstiary";
  }
  return null;
}
