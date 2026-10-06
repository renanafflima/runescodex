export const COMBAT_ELEMENTS = [
  "energy",
  "ice",
  "fire",
  "earth",
  "holy",
  "death",
  "physical",
] as const;

export type CombatElement = (typeof COMBAT_ELEMENTS)[number];

const ELEMENT_ALIASES: Record<string, CombatElement> = {
  energy: "energy",
  ice: "ice",
  fire: "fire",
  earth: "earth",
  poison: "earth",
  holy: "holy",
  death: "death",
  curse: "death",
  physical: "physical",
};

const CHARM_TO_ELEMENT: Record<string, CombatElement> = {
  wound: "physical",
  poison: "earth",
  enflame: "fire",
  freeze: "ice",
  zap: "energy",
  curse: "death",
  divine_wrath: "holy",
  divinewrath: "holy",
};

const ELEMENT_LABEL: Record<CombatElement, string> = {
  energy: "Energy",
  ice: "Ice",
  fire: "Fire",
  earth: "Earth",
  holy: "Holy",
  death: "Death",
  physical: "Physical",
};

const ELEMENT_FILE: Record<CombatElement, string> = {
  energy: "energy.webp",
  ice: "ice.webp",
  fire: "fire.webp",
  earth: "poison.webp",
  holy: "holy.webp",
  death: "death.webp",
  physical: "phisical.webp",
};

export function normalizeCombatElement(value: unknown): CombatElement | null {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (ELEMENT_ALIASES[key]) return ELEMENT_ALIASES[key];
  if (CHARM_TO_ELEMENT[key]) return CHARM_TO_ELEMENT[key];
  return CHARM_TO_ELEMENT[key.replace(/_/g, "")] || null;
}

export function elementLabel(value: CombatElement) {
  return ELEMENT_LABEL[value];
}

export function elementAsset(value: CombatElement) {
  return `images/elements/${ELEMENT_FILE[value]}`;
}

export const ELEMENT_FILTERS = ["Any", ...COMBAT_ELEMENTS] as const;
export type ElementFilter = (typeof ELEMENT_FILTERS)[number];

export function uniqueElements(values: unknown[]): CombatElement[] {
  const seen: CombatElement[] = [];
  values.forEach((value) => {
    const element = normalizeCombatElement(value);
    if (element && !seen.includes(element)) seen.push(element);
  });
  return seen;
}
