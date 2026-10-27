import type { BossLevel, BossParty } from "./bosstiary";

/**
 * Editorial RuneCodex classification. Empty until a reviewed source assigns
 * Solo, PT, Evento and a recommended level. Do not infer these from the
 * TibiaWiki candidate list or from a boss name.
 */
export const reviewedBosses: Array<{
  slug: string;
  party: BossParty;
  recommendedLevel: BossLevel;
}> = [];
