import { describe, expect, it } from "vitest";
import {
  CHARM_GUIDE_CATEGORIES,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
  formatRelativePt,
  isCatalogCreatureId,
  isCatalogHuntId,
  isCharmGuideUuid,
} from "./charm-guides";

const HYDRA = "c30000001-0001-4000-8000-000000000022";

describe("charm-guides domain", () => {
  it("accepts RFC UUIDs for guide records and rejects slugs", () => {
    expect(isCharmGuideUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isCharmGuideUuid("hydra")).toBe(false);
    expect(isCharmGuideUuid("dragon")).toBe(false);
    expect(isCharmGuideUuid("")).toBe(false);
  });

  it("accepts catalog creature and hunt ids including legacy seed values", () => {
    expect(isCatalogCreatureId(HYDRA)).toBe(true);
    expect(isCatalogCreatureId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isCatalogCreatureId("hydra")).toBe(false);
    expect(isCatalogHuntId("hunt-012")).toBe(true);
    expect(isCatalogHuntId("banuta")).toBe(false);
  });
  it("exposes the four approved charm point categories", () => {
    expect(CHARM_GUIDE_CATEGORIES.map((item) => item.targetPoints)).toEqual([
      100, 200, 300, 500,
    ]);
  });

  it("resolves category labels and points", () => {
    expect(charmGuideCategoryLabel("CP_300")).toBe("Avançado");
    expect(charmGuideCategoryPoints("CP_500")).toBe(500);
  });

  it("formats relative dates in Portuguese", () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativePt(recent)).toMatch(/^há \d+ min$/);
  });
});
