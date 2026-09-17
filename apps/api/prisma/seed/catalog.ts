/**
 * Small catalog used to validate the Creature / Hunt / Bestiary schema.
 * Values come from the existing mobile mocks:
 * - apps/mobile/src/data/hunts.js
 * - apps/mobile/app/(tabs)/bestiary.js
 *
 * Image paths preserve real filenames under apps/mobile/assets/.
 * Creature experience, elemental % modifiers, loot, extra vocations and
 * inferred charms are omitted — those are not present in the mocks.
 *
 * Bestiary estimated time is not stored. Derive it as:
 *   Math.ceil(killsRequired / estimatedKillsPerHour)
 */

export type SeedLootItem = {
  itemName: string;
  itemImage?: string | null;
  estimatedValue?: number | null;
  importance?: number | null;
};

export const CREATURES = [
  {
    slug: "cyclops",
    name: "Cyclops",
    image: "runescodex/creatures/Cyclops.gif",
    hp: 260,
    difficulty: "EASY",
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+cyclops+hunt",
  },
  {
    slug: "cyclops-smith",
    name: "Cyclops Smith",
    image: "runescodex/creatures/Cyclops_Smith.gif",
  },
  {
    slug: "cyclops-drone",
    name: "Cyclops Drone",
    image: "runescodex/creatures/Cyclops_Drone.gif",
  },
  {
    slug: "dragon",
    name: "Dragon",
    image: "runescodex/creatures/Dragon.gif",
    hp: 1000,
    difficulty: "MEDIUM",
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+dragon+hunt",
  },
  {
    slug: "dragon-hatchling",
    name: "Dragon Hatchling",
    image: "runescodex/creatures/Dragon_Hatchling.gif",
  },
  {
    slug: "dragon-lord-hatchling",
    name: "Dragon Lord Hatchling",
    image: "runescodex/creatures/Dragon_Lord_Hatchling.gif",
  },
  {
    slug: "hydra",
    name: "Hydra",
    image: "runescodex/creatures/Hydra.gif",
    hp: 2350,
    difficulty: "HARD",
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+hydra+hunt",
  },
  {
    slug: "serpent-spawn",
    name: "Serpent Spawn",
    image: "runescodex/creatures/Serpent_Spawn.gif",
  },
  {
    slug: "medusa",
    name: "Medusa",
    image: "runescodex/creatures/Medusa.gif",
  },
  {
    slug: "demon",
    name: "Demon",
    image: "runescodex/creatures/Demon.gif",
    hp: 8200,
    difficulty: "VERY_HARD",
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+demon+hunt",
  },
  {
    slug: "grim-reaper",
    name: "Grim Reaper",
    image: "runescodex/creatures/Grim_Reaper.gif",
  },
  {
    slug: "hellhound",
    name: "Hellhound",
    image: "runescodex/creatures/Hellhound.gif",
  },
  {
    slug: "fire-elemental",
    name: "Fire Elemental",
    image: "runescodex/creatures/Fire_Elemental.gif",
  },
] as const;

/**
 * Elemental modifiers are not in the current mocks (only weakness names).
 * Keep this list empty until curated percentages are available.
 * Example: { creatureSlug: "demon", element: "HOLY", modifier: 150 }
 */
export const CREATURE_ELEMENTS: ReadonlyArray<{
  creatureSlug: string;
  element:
    | "PHYSICAL"
    | "FIRE"
    | "ICE"
    | "EARTH"
    | "ENERGY"
    | "HOLY"
    | "DEATH";
  modifier: number;
}> = [];

export const CREATURE_LOCATIONS = [
  { creatureSlug: "cyclops", name: "Cyclops Cave", region: "Thais" },
  { creatureSlug: "dragon", name: "Darashia - Dragon Lair", region: "Desert" },
  { creatureSlug: "hydra", name: "Tiquanda - Hydra Cave", region: "Jungle" },
  { creatureSlug: "demon", name: "Edron - Demon Pits", region: "Hell" },
] as const;

export const CREATURE_TOGETHER = [
  { creatureSlug: "cyclops", relatedSlug: "cyclops-smith" },
  { creatureSlug: "cyclops", relatedSlug: "cyclops-drone" },
  { creatureSlug: "dragon", relatedSlug: "dragon-hatchling" },
  { creatureSlug: "dragon", relatedSlug: "dragon-lord-hatchling" },
  { creatureSlug: "hydra", relatedSlug: "serpent-spawn" },
  { creatureSlug: "hydra", relatedSlug: "medusa" },
  { creatureSlug: "demon", relatedSlug: "hellhound" },
  { creatureSlug: "demon", relatedSlug: "fire-elemental" },
] as const;

export const BESTIARY_ENTRIES = [
  {
    creatureSlug: "cyclops",
    category: "Thais",
    killsRequired: 500,
    estimatedKillsPerHour: 260,
  },
  {
    creatureSlug: "dragon",
    category: "Desert",
    killsRequired: 1000,
    estimatedKillsPerHour: 180,
  },
  {
    creatureSlug: "hydra",
    category: "Jungle",
    killsRequired: 1000,
    estimatedKillsPerHour: 110,
  },
  {
    creatureSlug: "demon",
    category: "Hell",
    killsRequired: 1000,
    estimatedKillsPerHour: 55,
  },
] as const;

export const HUNTS = [
  {
    slug: "cyclops-hunt",
    name: "Cyclops Hunt",
    location: "Thais",
    subLocation: "Cyclops Cave",
    difficulty: "EASY",
    mapImage: "maps/cyclops.png",
    vocations: [
      {
        vocation: "EK",
        isRecommended: true,
        levelMin: 40,
        xpPerHour: 180000,
        profitPerHour: 30000,
        notes: "Physical / Energy (arma + suporte)",
      },
    ],
    creatures: [
      { creatureSlug: "cyclops", isPrimary: true },
      { creatureSlug: "cyclops-smith", isPrimary: false },
      { creatureSlug: "cyclops-drone", isPrimary: false },
    ],
    videos: [
      {
        title: "Cyclops Hunt",
        url: "https://www.youtube.com/results?search_query=tibia+cyclops+hunt",
        isRecommended: true,
      },
    ],
    loot: [] as SeedLootItem[],
  },
  {
    slug: "dragon-hunt",
    name: "Dragon Hunt",
    location: "Darashia",
    subLocation: "Dragon Lair",
    difficulty: "MEDIUM",
    mapImage: "maps/dragon.png",
    vocations: [
      {
        vocation: "MS",
        isRecommended: true,
        levelMin: 80,
        xpPerHour: 450000,
        profitPerHour: 60000,
        notes: "Ice / Physical (Avalanche/SD conforme voc)",
      },
    ],
    creatures: [
      { creatureSlug: "dragon", isPrimary: true },
      { creatureSlug: "dragon-hatchling", isPrimary: false },
      { creatureSlug: "dragon-lord-hatchling", isPrimary: false },
    ],
    videos: [
      {
        title: "Dragon Hunt",
        url: "https://www.youtube.com/results?search_query=tibia+dragon+hunt",
        isRecommended: true,
      },
    ],
    loot: [] as SeedLootItem[],
  },
  {
    slug: "hydra-hunt",
    name: "Hydra Hunt",
    location: "Tiquanda",
    subLocation: "Hydra Cave",
    difficulty: "HARD",
    mapImage: "maps/hydra.png",
    vocations: [
      {
        vocation: "RP",
        isRecommended: true,
        levelMin: 150,
        xpPerHour: 900000,
        profitPerHour: 120000,
        notes: "Ice / Energy (Avalanche/GFB + set)",
      },
    ],
    creatures: [
      { creatureSlug: "hydra", isPrimary: true },
      { creatureSlug: "serpent-spawn", isPrimary: false },
      { creatureSlug: "medusa", isPrimary: false },
    ],
    videos: [
      {
        title: "Hydra Hunt",
        url: "https://www.youtube.com/results?search_query=tibia+hydra+hunt",
        isRecommended: true,
      },
    ],
    loot: [] as SeedLootItem[],
  },
  {
    slug: "demon-hunt",
    name: "Demon Hunt",
    location: "Edron",
    subLocation: "Demon Pits",
    difficulty: "VERY_HARD",
    mapImage: "maps/demon.png",
    vocations: [
      {
        vocation: "ED",
        isRecommended: true,
        levelMin: 250,
        xpPerHour: 1200000,
        profitPerHour: 180000,
        notes: "Holy / Ice (SD + suporte)",
      },
    ],
    creatures: [
      { creatureSlug: "demon", isPrimary: true, recommendedCharm: "FREEZE" },
      { creatureSlug: "grim-reaper", isPrimary: false, recommendedCharm: "ZAP" },
      { creatureSlug: "hellhound", isPrimary: false },
    ],
    videos: [
      {
        title: "Demon Hunt",
        url: "https://www.youtube.com/results?search_query=tibia+demon+hunt",
        isRecommended: true,
      },
    ],
    loot: [] as SeedLootItem[],
  },
] as const;
