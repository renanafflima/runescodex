import extracted from "../../../../scripts/bosses-extracted.json";
import { assetUrl } from "../lib/assets";
import spriteFileNames from "./boss-sprite-files.json";
import { creatureImageKey } from "./creature-image";
import {
  applyBossReview,
  bossImageUrl,
  indexBossImages,
  type BosstiaryEntry,
} from "./bosstiary";
import { reviewedBosses } from "./bosstiary-reviewed";

export type BosstiaryCatalog = {
  entries: BosstiaryEntry[];
  skipped: number;
};

function bossImages() {
  const files = spriteFileNames.flatMap((fileName) => {
    if (!creatureImageKey(fileName)) return [];
    return [{ fileName, url: assetUrl(`images/bosses/${encodeURIComponent(fileName)}`) }];
  });
  return indexBossImages(files);
}

function isCandidate(value: unknown): value is {
  name: string;
  slug: string;
  sourceUrl: string;
  isboss: string;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === "string" &&
    row.name.trim().length > 0 &&
    typeof row.slug === "string" &&
    row.slug.trim().length > 0 &&
    typeof row.sourceUrl === "string" &&
    row.sourceUrl.startsWith("https://") &&
    typeof row.isboss === "string" &&
    row.isboss.trim().length > 0
  );
}

export function loadBosstiaryCatalog(): BosstiaryCatalog {
  if (!Array.isArray(extracted)) {
    throw new Error("A lista de bosses extraída não é uma lista.");
  }
  const images = bossImages();
  const seen = new Set<string>();
  const entries: BosstiaryEntry[] = [];
  let skipped = 0;

  for (const row of extracted) {
    if (!isCandidate(row) || seen.has(row.slug)) {
      skipped += 1;
      continue;
    }
    seen.add(row.slug);
    const name = row.name.trim();
    const slug = row.slug.trim();
    entries.push({
      name,
      slug,
      sourceUrl: row.sourceUrl,
      isboss: row.isboss.trim(),
      source: "tibiawiki-candidate",
      party: null,
      recommendedLevel: null,
      imageUrl: bossImageUrl(name, slug, images),
      rewards: [],
      location: null,
      bossPoints: null,
    });
  }

  if (entries.length === 0) {
    throw new Error("Nenhum boss candidato pôde ser lido.");
  }

  return {
    entries: applyBossReview(entries, reviewedBosses),
    skipped,
  };
}
