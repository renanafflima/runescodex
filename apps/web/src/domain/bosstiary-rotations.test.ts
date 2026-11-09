import { describe, expect, it } from "vitest";
import {
  BOSSTIARY_TABS,
  BOSSTIARY_TIME_OPTIONS,
  parseBosstiaryTab,
  parseCommunityInnerView,
} from "./bosstiary-rotations";

describe("bosstiary rotations domain", () => {
  it("defaults to comunidade and accepts the three main areas", () => {
    expect(parseBosstiaryTab(null)).toBe("comunidade");
    expect(parseBosstiaryTab("")).toBe("comunidade");
    expect(parseBosstiaryTab("progresso")).toBe("progresso");
    expect(parseBosstiaryTab("enciclopedia")).toBe("enciclopedia");
    expect(parseBosstiaryTab("rotas")).toBe("comunidade");
    expect(parseBosstiaryTab("level")).toBe("comunidade");
    expect(parseBosstiaryTab("unknown")).toBe("comunidade");
  });

  it("maps old rotation and level URLs to community inner views", () => {
    expect(parseCommunityInnerView(null, null)).toBe("feed");
    expect(parseCommunityInnerView("rotas", null)).toBe("feed");
    expect(parseCommunityInnerView("level", null)).toBe("level");
    expect(parseCommunityInnerView(null, "planner")).toBe("feed");
    expect(parseCommunityInnerView(null, "level")).toBe("level");
    expect(parseCommunityInnerView(null, "party")).toBe("party");
  });

  it("exposes only three main area cards", () => {
    expect(BOSSTIARY_TABS.map((item) => item.id)).toEqual([
      "comunidade",
      "progresso",
      "enciclopedia",
    ]);
  });

  it("exposes the four approved time cards", () => {
    expect(BOSSTIARY_TIME_OPTIONS.map((item) => item.minutes)).toEqual([15, 20, 30, 60]);
  });
});
