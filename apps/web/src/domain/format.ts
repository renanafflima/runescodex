export function hasNumericValue(value: unknown) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

export function toNumberOrNull(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function formatRate(value: unknown) {
  if (!hasNumericValue(value)) return null;
  const amount = Number(value);
  if (amount >= 1_000_000) {
    const compact = amount / 1_000_000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1).replace(".", ",")}M`;
  }
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(amount);
}

export function formatCount(value: unknown) {
  if (!hasNumericValue(value)) return null;
  return String(Math.round(Number(value)));
}

export function formatLevelRange(levelMin: unknown, levelMax: unknown) {
  if (levelMin == null && levelMax == null) return null;
  if (levelMin != null && levelMax != null && Number(levelMin) !== Number(levelMax)) {
    return `${levelMin}–${levelMax}`;
  }
  if (levelMin != null) return `${levelMin}+`;
  return `≤${levelMax}`;
}

export function formatDifficultyLabel(value: unknown) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

export function formatCharmLabel(value: unknown) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

export function formatHuntLocation(location: unknown, subLocation: unknown) {
  return [location, subLocation].filter(Boolean).join(" - ");
}

export function initialsFrom(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "R";
  return trimmed.slice(0, 1).toUpperCase();
}
