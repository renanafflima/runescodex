import { describe, expect, it } from "vitest";
import { BOSSTIARY_TIME_OPTIONS, parseBosstiaryTab } from "./bosstiary-rotations";

describe("bosstiary rotations domain", () => {
  it("defaults to rotas and accepts known tabs", () => {
    expect(parseBosstiaryTab(null)).toBe("rotas");
    expect(parseBosstiaryTab("")).toBe("rotas");
    expect(parseBosstiaryTab("enciclopedia")).toBe("enciclopedia");
    expect(parseBosstiaryTab("level")).toBe("level");
    expect(parseBosstiaryTab("unknown")).toBe("rotas");
  });

  it("exposes the four approved time cards", () => {
    expect(BOSSTIARY_TIME_OPTIONS.map((item) => item.minutes)).toEqual([15, 20, 30, 60]);
  });
});
