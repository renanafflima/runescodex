import { describe, expect, it } from "vitest";
import { BOSSTIARY_TIME_OPTIONS, parseBosstiaryTab } from "./bosstiary-rotations";

describe("bosstiary rotations domain", () => {
  it("defaults to comunidade and accepts known tabs", () => {
    expect(parseBosstiaryTab(null)).toBe("comunidade");
    expect(parseBosstiaryTab("")).toBe("comunidade");
    expect(parseBosstiaryTab("rotas")).toBe("rotas");
    expect(parseBosstiaryTab("enciclopedia")).toBe("enciclopedia");
    expect(parseBosstiaryTab("level")).toBe("level");
    expect(parseBosstiaryTab("unknown")).toBe("comunidade");
  });

  it("exposes the four approved time cards", () => {
    expect(BOSSTIARY_TIME_OPTIONS.map((item) => item.minutes)).toEqual([15, 20, 30, 60]);
  });
});
