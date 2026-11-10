import { describe, expect, it } from "vitest";
import {
  CHARM_GUIDE_CATEGORIES,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
  formatRelativePt,
} from "./charm-guides";

describe("charm-guides domain", () => {
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
