import { describe, expect, it } from "vitest";
import {
  CHARM_GUIDE_CATEGORIES,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
  formatRelativePt,
  isCharmGuideUuid,
} from "./charm-guides";

describe("charm-guides domain", () => {
  it("accepts v4 UUIDs for guide and creature ids", () => {
    expect(isCharmGuideUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isCharmGuideUuid("dragon")).toBe(false);
    expect(isCharmGuideUuid("")).toBe(false);
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
