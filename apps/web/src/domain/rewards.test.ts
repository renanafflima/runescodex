import { describe, expect, it } from "vitest";
import {
  affordancePercent,
  catalogArtFile,
  diamondOffers,
  formatRenewal,
  isPlayableRewardMission,
  missionArtFile,
  progressPercent,
  rewardsActionMessage,
} from "./rewards";

describe("web rewards presentation", () => {
  it("keeps only missions the server can record", () => {
    expect(isPlayableRewardMission({
      eventType: "FORUM_TOPIC_CREATED",
      title: "Poste no Fórum",
      description: "Crie um tópico.",
      category: "COMMUNITY",
    })).toBe(true);
    expect(isPlayableRewardMission({
      eventType: "HUNT_ACTION",
      title: "Complete 3 Hunts",
      description: "Registre uma hunt.",
      category: "HUNT",
    })).toBe(false);
    expect(isPlayableRewardMission({
      eventType: "AD_WATCHED",
      title: "Assista anúncios",
      description: "Ganhe pontos.",
      category: "ADS",
    })).toBe(false);
    expect(isPlayableRewardMission({
      eventType: null,
      title: "Poste no Fórum",
      description: "",
      category: "COMMUNITY",
    })).toBe(false);
  });

  it("maps mission and catalog art without inventing a picture", () => {
    expect(missionArtFile({ imageKey: "missionForum", category: "COMMUNITY" })).toBe("mission-forum.png");
    expect(missionArtFile({ imageKey: "unknown", category: "HUNT" })).toBe("mission-hunts.png");
    expect(catalogArtFile({ imageKey: "tc125" })).toBe("tc-125.png");
    expect(catalogArtFile({ imageKey: "missing" })).toBeNull();
  });

  it("keeps diamond offers closed until the API publishes a rate", () => {
    expect(diamondOffers({ enabled: false, rate: null }).every((offer) => offer.enabled === false)).toBe(true);
    expect(diamondOffers({ enabled: true, rate: { goldCost: 10, diamondGranted: 1 } }).map((offer) => offer.goldCost)).toEqual([10, 30]);
  });

  it("formats renewal and progress from real numbers", () => {
    expect(formatRenewal("2026-10-10T00:00:00.000Z", new Date("2026-10-09T09:38:00.000Z"))).toBe("14h 22m");
    expect(Math.round(progressPercent(1, 3))).toBe(33);
    expect(affordancePercent(29, 50, true)).toBe(58);
    expect(affordancePercent(10, 0, false)).toBeNull();
    expect(rewardsActionMessage("Insufficient points")).toBe("Pontos insuficientes para esta conversão.");
  });
});
