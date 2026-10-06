export const VOCATIONS = ["EK", "RP", "ED", "MS", "EM"] as const;

export type VocationCode = (typeof VOCATIONS)[number];

const VOCATION_ALIASES: Record<string, VocationCode> = {
  ek: "EK",
  knight: "EK",
  eliteknight: "EK",
  rp: "RP",
  paladin: "RP",
  royalpaladin: "RP",
  ed: "ED",
  druid: "ED",
  elderdruid: "ED",
  ms: "MS",
  sorcerer: "MS",
  mastersorcerer: "MS",
  em: "EM",
  monk: "EM",
  exaltedmonk: "EM",
};

export function normalizeVocation(value: unknown): VocationCode | null {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return VOCATION_ALIASES[key] || null;
}

export function isVocationCode(value: string): value is VocationCode {
  return VOCATIONS.includes(value as VocationCode);
}
