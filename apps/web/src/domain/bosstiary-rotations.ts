import type { VocationCode } from "./vocation";

export type BosstiaryTab = "comunidade" | "rotas" | "level" | "enciclopedia";

export type BosstiaryHuntMode = "SOLO" | "PARTY";

export const BOSSTIARY_TABS: Array<{ id: BosstiaryTab; label: string }> = [
  { id: "comunidade", label: "Comunidade" },
  { id: "rotas", label: "Rotações" },
  { id: "level", label: "Boss por level" },
  { id: "enciclopedia", label: "Enciclopédia" },
];

export const BOSSTIARY_TIME_OPTIONS = [
  { minutes: 15, title: "15 min", subtitle: "Uma pausa rápida." },
  { minutes: 20, title: "20 min", subtitle: "Uma sessão curta." },
  { minutes: 30, title: "30 min", subtitle: "Tempo para explorar." },
  { minutes: 60, title: "60 min", subtitle: "Uma hora de farm." },
] as const;

export type BosstiaryTimeMinutes = (typeof BOSSTIARY_TIME_OPTIONS)[number]["minutes"];

export const BOSSTIARY_ORIGIN_CITIES = [
  "Thais",
  "Carlin",
  "Venore",
  "Kazordoon",
  "Ab'Dendriel",
  "Edron",
  "Darashia",
  "Ankrahmun",
  "Port Hope",
  "Liberty Bay",
  "Yalahar",
  "Svargrond",
  "Farmine",
  "Rathleton",
  "Roshamuul",
  "Issavi",
] as const;

export const BOSSTIARY_LEVEL_JOURNEYS: Array<{ level: number; title: string; blurb: string }> = [
  { level: 300, title: "Primeiros bosses", blurb: "Entradas solo e PT com recomendação revisada em 300." },
  { level: 500, title: "Rotina intermediária", blurb: "Bosses com faixa editorial 500 para solo ou grupo." },
  { level: 700, title: "Desafios avançados", blurb: "Caçadas mais exigentes na faixa 700." },
  { level: 1000, title: "Endgame", blurb: "Bosses na faixa editorial 1000." },
];

export type BosstiaryRotationQuery = {
  availableMinutes: BosstiaryTimeMinutes;
  level: number;
  huntMode: BosstiaryHuntMode;
  vocation: VocationCode;
  originCity: string;
};

export type BosstiaryRotationStop = {
  position: number;
  slug: string;
  name: string;
  locationName: string | null;
  locationRegion: string | null;
  originCity: string;
  combatMinutes: number;
  travelMinutes: number;
  travelKnown: boolean;
  cooldownSeconds: number | null;
  accessRequirements: string | null;
  bossPoints: number | null;
  recommendedLevel: number;
};

export type BosstiaryRotation = {
  id: string;
  name: string;
  kind: "EXPRESS" | "PROGRESSION" | "ALTERNATIVE";
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
  stops: BosstiaryRotationStop[];
};

export type BosstiaryRotationResult = {
  items: BosstiaryRotation[];
  dataGaps: string[];
  emptyReason: string | null;
};

export function parseBosstiaryTab(value: string | null): BosstiaryTab {
  if (value === "rotas" || value === "level" || value === "enciclopedia") return value;
  return "comunidade";
}

export function huntModeLabel(mode: BosstiaryHuntMode) {
  return mode === "SOLO" ? "Solo" : "Grupo";
}
