import type {
  CharmGuideCpCategory,
  CharmGuideDifficulty,
} from "../services/api/charm-guides";

export const CHARM_GUIDE_CATEGORIES: Array<{
  cpCategory: CharmGuideCpCategory;
  targetPoints: number;
  label: string;
  tone: string;
  blurb: string;
}> = [
  {
    cpCategory: "CP_100",
    targetPoints: 100,
    label: "Fácil",
    tone: "#70c987",
    blurb: "Comece com criaturas acessíveis e avance por etapas.",
  },
  {
    cpCategory: "CP_200",
    targetPoints: 200,
    label: "Médio",
    tone: "#b58be9",
    blurb: "Uma sequência com variedade maior de criaturas.",
  },
  {
    cpCategory: "CP_300",
    targetPoints: 300,
    label: "Avançado",
    tone: "#74b8df",
    blurb: "Para quem quer ampliar a pontuação com desafios.",
  },
  {
    cpCategory: "CP_500",
    targetPoints: 500,
    label: "Desafiador",
    tone: "#d8ae55",
    blurb: "Uma jornada longa para buscar uma grande recompensa.",
  },
];

export const CHARM_GUIDE_DIFFICULTY_LABEL: Record<CharmGuideDifficulty, string> = {
  EASY: "Fácil",
  MEDIUM: "Médio",
  ADVANCED: "Avançado",
  CHALLENGING: "Desafiador",
};

export function charmGuideCategoryLabel(category: CharmGuideCpCategory) {
  return CHARM_GUIDE_CATEGORIES.find((item) => item.cpCategory === category)?.label ?? category;
}

export function charmGuideCategoryPoints(category: CharmGuideCpCategory) {
  return CHARM_GUIDE_CATEGORIES.find((item) => item.cpCategory === category)?.targetPoints ?? 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCharmGuideUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function formatRelativePt(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}
