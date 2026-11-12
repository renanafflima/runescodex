import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CharmGuideStepDto } from "./charm-guide-step.dto";

const HYDRA = "c30000001-0001-4000-8000-000000000022";
const STANDARD = "cde3d3a7-5ccc-4577-8fbc-5a4c5d8a168d";

describe("CharmGuideStepDto", () => {
  it("accepts legacy creature and hunt ids from the catalog seed", async () => {
    const dto = plainToInstance(CharmGuideStepDto, {
      huntId: "hunt-012",
      creatureIds: [HYDRA, STANDARD],
    });
    expect(await validate(dto)).toEqual([]);
  });

  it("rejects slug-like creature ids", async () => {
    const dto = plainToInstance(CharmGuideStepDto, {
      creatureIds: ["hydra"],
    });
    const errors = await validate(dto);
    expect(errors.some((item) => item.property === "creatureIds")).toBe(true);
  });
});
