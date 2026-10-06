import { describe, expect, it } from "vitest";
import { normalizeCombatElement, uniqueElements } from "./elements";

describe("combat elements", () => {
  it("maps official charms to attack elements", () => {
    expect(normalizeCombatElement("zap")).toBe("energy");
    expect(normalizeCombatElement("enflame")).toBe("fire");
    expect(normalizeCombatElement("freeze")).toBe("ice");
    expect(normalizeCombatElement("poison")).toBe("earth");
    expect(normalizeCombatElement("wound")).toBe("physical");
    expect(normalizeCombatElement("divine_wrath")).toBe("holy");
    expect(normalizeCombatElement("curse")).toBe("death");
  });

  it("keeps unique normalized elements in first-seen order", () => {
    expect(uniqueElements(["zap", "energy", "holy", "Holy"])).toEqual(["energy", "holy"]);
  });
});
