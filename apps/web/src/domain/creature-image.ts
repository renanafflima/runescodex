import { assetUrl } from "../lib/assets";
import { isSafeHttpsUrl } from "../lib/https-url";
import { CREATURE_FILE_BY_KEY } from "./creature-assets";

export function creatureImageKey(value: unknown) {
  const file = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  return String(file || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function resolveCreatureImage(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (isSafeHttpsUrl(candidate)) return candidate.trim();
    const key = creatureImageKey(candidate);
    const file = key ? CREATURE_FILE_BY_KEY[key] : undefined;
    if (file) return assetUrl(`images/creatures/${file}`);
  }
  return null;
}
