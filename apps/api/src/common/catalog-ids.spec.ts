import {
  isCatalogCreatureId,
  isCatalogHuntId,
  isCharmGuideRecordId,
} from "./catalog-ids";

describe("catalog ids", () => {
  const hydra = "c30000001-0001-4000-8000-000000000022";
  const cyclops = "cde3d3a7-5ccc-4577-8fbc-5a4c5d8a168d";

  it("accepts legacy and RFC creature ids", () => {
    expect(isCatalogCreatureId(hydra)).toBe(true);
    expect(isCatalogCreatureId(cyclops)).toBe(true);
    expect(isCatalogCreatureId("dragon")).toBe(false);
    expect(isCatalogCreatureId("")).toBe(false);
  });

  it("accepts legacy and RFC hunt ids", () => {
    expect(isCatalogHuntId("hunt-012")).toBe(true);
    expect(isCatalogHuntId("67d87289-d3b6-43fd-b090-f5d845a3ab28")).toBe(true);
    expect(isCatalogHuntId("banuta")).toBe(false);
  });

  it("rejects slug-like charm guide tokens", () => {
    expect(isCharmGuideRecordId("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    expect(isCharmGuideRecordId("hydra")).toBe(false);
  });
});
