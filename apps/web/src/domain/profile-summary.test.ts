import { describe, expect, it } from "vitest";
import { emblemProgressLabel, isEmblemUnlocked } from "./profile-summary";
import type { ProfileMeResponse } from "../services/api/profile";

function emblems(partial: Partial<ProfileMeResponse["emblems"]>): ProfileMeResponse["emblems"] {
  return {
    criteriaStatus: "PENDING",
    catalogTotal: 12,
    unlockedCount: 0,
    unlockedIds: [],
    ...partial,
  };
}

describe("profile-summary", () => {
  it("keeps emblems locked while criteria are pending", () => {
    const bundle = emblems({ unlockedIds: ["primeiros-passos"], unlockedCount: 1 });
    expect(isEmblemUnlocked(bundle, "primeiros-passos")).toBe(false);
    expect(emblemProgressLabel(bundle)).toBe("0 / 12 conquistadas");
  });

  it("uses catalogTotal from the API for the progress label", () => {
    const bundle = emblems({ catalogTotal: 12, unlockedCount: 0 });
    expect(emblemProgressLabel(bundle)).toBe("0 / 12 conquistadas");
  });
});
