import { describe, expect, it } from "vitest";
import { bestiaryApiDifficulty, filterBestiary, mapBestiaryEntry } from "./bestiary";

describe("bestiary mapping", () => {
  it("maps API entries without inventing missing fields", () => {
    const mapped = mapBestiaryEntry({
      id: "1",
      name: "Cyclops",
      slug: "cyclops",
      image: "https://cdn.example/cyclops.gif",
      hp: 260,
      experience: 150,
      difficulty: "EASY",
      estimatedKillsPerHour: 250,
      killsRequired: 500,
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
      locations: [{ name: "Thais", region: "Tibia" }],
      together: [{ name: "Cyclops Drone" }],
      elements: [{ element: "Energy" }],
      progress: { kills: 125, completed: false, completedAt: null, progressPercentage: 25 },
    });

    expect(mapped).toMatchObject({
      name: "Cyclops",
      slug: "cyclops",
      difficulty: "Easy",
      location: "Thais",
      region: "Tibia",
      killsRequired: 500,
      estimatedHours: 2,
      killTogether: ["Cyclops Drone"],
      progress: { kills: 125, progressPercentage: 25 },
    });
    expect(mapped.description).toBeNull();
  });

  it("ignores unsafe image and video URLs", () => {
    const mapped = mapBestiaryEntry({
      name: "Dragon",
      slug: "dragon",
      image: "http://insecure.example/dragon.gif",
      youtubeUrl: "javascript:alert(1)",
      locations: [],
      together: [],
      elements: [],
    });
    expect(mapped.image).toBeNull();
    expect(mapped.youtubeUrl).toBeNull();
  });

  it("converts UI difficulty filters to API enums", () => {
    expect(bestiaryApiDifficulty("All")).toBeUndefined();
    expect(bestiaryApiDifficulty("Very Hard")).toBe("VERY_HARD");
  });

  it("filters by search and keeps empty results empty", () => {
    const entries = [
      mapBestiaryEntry({ name: "Cyclops", slug: "cyclops", difficulty: "EASY", locations: [], together: [], elements: [] }),
    ];
    expect(filterBestiary(entries, "dragon", "All")).toEqual([]);
    expect(filterBestiary(entries, "cyc", "All")[0]?.slug).toBe("cyclops");
  });
});
