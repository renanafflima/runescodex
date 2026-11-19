import { beforeEach, describe, expect, it, vi } from "vitest";

const trackRewardActivity = vi.fn().mockResolvedValue({ applied: [] });

vi.mock("../services/api/rewards", () => ({
  trackRewardActivity: (...args: unknown[]) => trackRewardActivity(...args),
}));

describe("reportRewardActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", {
      randomUUID: () => "uuid-test-1",
    });
  });

  it("keeps stable referenceId for distinct-entity views", async () => {
    const { reportRewardActivity } = await import("./rewards-activity");
    reportRewardActivity("CREATURE_VIEWED", "dragon", "Creature");
    expect(trackRewardActivity).toHaveBeenCalledWith(
      "CREATURE_VIEWED",
      "dragon",
      "Creature",
    );
  });

  it("appends uuid for repeatable activities without granting points itself", async () => {
    const { reportRewardActivity } = await import("./rewards-activity");
    reportRewardActivity("SHARE_LINK_CLICKED", "hunt-1", "HuntShare");
    expect(trackRewardActivity).toHaveBeenCalledWith(
      "SHARE_LINK_CLICKED",
      "hunt-1:uuid-test-1",
      "HuntShare",
    );
  });
});
