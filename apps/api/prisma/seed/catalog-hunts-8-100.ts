/**
 * RunesCodex — catálogo inicial de Hunts reais (Lote 1)
 *
 * Base: páginas públicas do Intibia consultadas em 17/09/2026.
 * IMPORTANTE:
 * - Algumas páginas do Intibia estão marcadas como "desatualizadas".
 * - XP/profit são valores NORMALIZADOS para o seed usando o menor valor
 *   explícito da faixa publicada quando a fonte fornece uma faixa.
 * - O catálogo usa apenas dados que a fonte sustenta.
 * - Não altera schema/migrations.
 *
 * Vocações:
 * EK = Knight
 * RP = Paladin
 * ED = Druid
 * MS = Sorcerer
 */

export const HUNTS_BATCH_8_100 = [
  {
    slug: "ancient-temple-rotworms",
    name: "Ancient Temple Rotworms",
    location: "Thais",
    subLocation: "Ancient Temple",
    difficulty: "EASY",
    sourceUrl: "https://intibia.com/pt/hunts/Ic9A3/druid-sorcerer-ancient-temple-rotworms",
    vocations: [
      {
        vocation: "ED",
        isRecommended: true,
        levelMin: 8,
        xpPerHour: 15000,
        profitPerHour: -2000,
        notes: "Fonte: Intibia. XP 15k–18k/h; profit -2k–2k/h.",
      },
      {
        vocation: "MS",
        isRecommended: true,
        levelMin: 8,
        xpPerHour: 15000,
        profitPerHour: -2000,
        notes: "Fonte: Intibia. XP 15k–18k/h; profit -2k–2k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "carrion-worm", isPrimary: true },
      { creatureSlug: "rotworm", isPrimary: true },
      { creatureSlug: "skeleton", isPrimary: false },
      { creatureSlug: "poison-spider", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Ancient Temple Rotworms",
        url: "https://intibia.com/pt/hunts/Ic9A3/druid-sorcerer-ancient-temple-rotworms",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "swamp-troll-cave",
    name: "Swamp Troll Cave",
    location: "Venore",
    subLocation: "Swamp Troll Cave",
    difficulty: "EASY",
    sourceUrl: "https://intibia.com/pt/hunts/6dtU2/paladin-swamp-troll-cave",
    vocations: [
      {
        vocation: "RP",
        isRecommended: true,
        levelMin: 8,
        xpPerHour: 10000,
        profitPerHour: 5000,
        notes: "Fonte: Intibia. XP 10k–30k/h; profit 5k–100k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "ghoul", isPrimary: false },
      { creatureSlug: "bat", isPrimary: false },
      { creatureSlug: "snake", isPrimary: false },
      { creatureSlug: "wisp", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Swamp Troll Cave",
        url: "https://intibia.com/pt/hunts/6dtU2/paladin-swamp-troll-cave",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "venore-amazon-camp",
    name: "Venore Amazon Camp",
    location: "Venore",
    subLocation: "Amazon Camp",
    difficulty: "EASY",
    sourceUrl: "https://intibia.com/pt/hunts/5LvSU/paladin-venore-amazon-camp",
    vocations: [
      {
        vocation: "RP",
        isRecommended: true,
        levelMin: 8,
        xpPerHour: 15000,
        profitPerHour: 10000,
        notes: "Fonte: Intibia. XP 15k–40k/h; profit 10k–100k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "hunter", isPrimary: true },
      { creatureSlug: "ghoul", isPrimary: false },
      { creatureSlug: "poacher", isPrimary: false },
      { creatureSlug: "amazon", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Venore Amazon Camp",
        url: "https://intibia.com/pt/hunts/5LvSU/paladin-venore-amazon-camp",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "venore-salamander-cave",
    name: "Venore Salamander Cave",
    location: "Venore",
    subLocation: "Salamander Cave",
    difficulty: "EASY",
    sourceUrl: "https://intibia.com/pt/hunts/kzgsi/knight-venore-salamander-cave",
    vocations: [
      {
        vocation: "EK",
        isRecommended: true,
        levelMin: 20,
        xpPerHour: 25000,
        profitPerHour: 30000,
        notes: "Fonte: Intibia. XP 25k–45k/h; profit 30k–60k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "marsh-stalker", isPrimary: true },
      { creatureSlug: "swampling", isPrimary: true },
      { creatureSlug: "emerald-damselfly", isPrimary: false },
      { creatureSlug: "salamander", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Venore Salamander Cave",
        url: "https://intibia.com/pt/hunts/kzgsi/knight-venore-salamander-cave",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "port-hope-swamp-trolls",
    name: "Port Hope Swamp Trolls",
    location: "Port Hope",
    subLocation: "Swamp Trolls",
    difficulty: "EASY",
    sourceUrl: "https://intibia.com/pt/hunts/fIyIF/paladin-port-hope-swamp-trolls",
    vocations: [
      {
        vocation: "RP",
        isRecommended: true,
        levelMin: 8,
        xpPerHour: 15000,
        profitPerHour: 10000,
        notes: "Fonte: Intibia. XP 15k–30k/h; profit 10k–100k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "bonelord", isPrimary: false },
      { creatureSlug: "skeleton", isPrimary: false },
      { creatureSlug: "crab", isPrimary: true },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Port Hope Swamp Trolls",
        url: "https://intibia.com/pt/hunts/fIyIF/paladin-port-hope-swamp-trolls",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "krailos-spider-lair",
    name: "Krailos Spider Lair",
    location: "Krailos",
    subLocation: "Spider Lair",
    difficulty: "HARD",
    sourceUrl: "https://intibia.com/pt/hunts/jHBKq/knight-krailos-spider-lair",
    vocations: [
      {
        vocation: "EK",
        isRecommended: true,
        levelMin: 100,
        xpPerHour: 150000,
        profitPerHour: 0,
        notes: "Fonte: Intibia. A página é 100+, portanto ficou fora do intervalo principal 8–100; mantida aqui como referência de transição. XP 150k–250k/h; profit 0–20k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "giant-spider", isPrimary: true },
      { creatureSlug: "brimstone-bug", isPrimary: false },
      { creatureSlug: "wailing-widow", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Krailos Spider Lair",
        url: "https://intibia.com/pt/hunts/jHBKq/knight-krailos-spider-lair",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "carlin-forbidden-temple",
    name: "Carlin Forbidden Temple",
    location: "Carlin",
    subLocation: "Floor -1",
    difficulty: "HARD",
    sourceUrl: "https://intibia.com/pt/hunts/Mggaz/knight-carlin-forbidden-temple-floor-1-fire-bombs",
    vocations: [
      {
        vocation: "EK",
        isRecommended: true,
        levelMin: 80,
        xpPerHour: 450000,
        profitPerHour: -70000,
        notes: "Fonte: Intibia. XP 450k–700k/h; profit -70k–50k/h.",
      },
    ],
    creatures: [
      { creatureSlug: "vile-grandmaster", isPrimary: true },
      { creatureSlug: "renegade-knight", isPrimary: true },
      { creatureSlug: "cult-scholar", isPrimary: false },
      { creatureSlug: "cult-enforcer", isPrimary: false },
      { creatureSlug: "vicious-squire", isPrimary: false },
      { creatureSlug: "cult-believer", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — Carlin Forbidden Temple",
        url: "https://intibia.com/pt/hunts/Mggaz/knight-carlin-forbidden-temple-floor-1-fire-bombs",
        isRecommended: true,
      },
    ],
    loot: [],
  },

  {
    slug: "the-hive-surface",
    name: "The Hive",
    location: "Gray Beach",
    subLocation: "The Hive Surface",
    difficulty: "MEDIUM",
    sourceUrl: "https://intibia.com/pt/hunts/EYMqp/knight-the-hive-surface",
    vocations: [
      {
        vocation: "EK",
        isRecommended: true,
        levelMin: 50,
        xpPerHour: 80000,
        profitPerHour: -8000,
        notes: "Fonte: Intibia. XP 80k–110k/h; profit -8k–0/h.",
      },
    ],
    creatures: [
      { creatureSlug: "hive-overseer", isPrimary: true },
      { creatureSlug: "spidris-elite", isPrimary: false },
      { creatureSlug: "spidris", isPrimary: false },
      { creatureSlug: "kollos", isPrimary: false },
      { creatureSlug: "spitter", isPrimary: false },
      { creatureSlug: "crawler", isPrimary: false },
      { creatureSlug: "waspoid", isPrimary: false },
      { creatureSlug: "insectoid-worker", isPrimary: false },
      { creatureSlug: "swarmer", isPrimary: false },
      { creatureSlug: "ladybug", isPrimary: false },
      { creatureSlug: "lesser-swarmer", isPrimary: false },
      { creatureSlug: "hive-pore", isPrimary: false },
    ],
    videos: [
      {
        title: "Fonte: Intibia — The Hive",
        url: "https://intibia.com/pt/hunts/EYMqp/knight-the-hive-surface",
        isRecommended: true,
      },
    ],
    loot: [],
  },
] as const;

/**
 * Criaturas novas referenciadas pelo lote.
 *
 * Imagem segue o padrão atual do projeto. HP/dificuldade só são preenchidos
 * quando já temos o dado no catálogo existente ou uma fonte explícita.
 */
export const CREATURES_BATCH_8_100 = [
  { slug: "carrion-worm", name: "Carrion Worm", image: "runescodex/creatures/Carrion_Worm.gif" },
  { slug: "rotworm", name: "Rotworm", image: "runescodex/creatures/Rotworm.gif" },
  { slug: "skeleton", name: "Skeleton", image: "runescodex/creatures/Skeleton.gif" },
  { slug: "poison-spider", name: "Poison Spider", image: "runescodex/creatures/Poison_Spider.gif" },
  { slug: "ghoul", name: "Ghoul", image: "runescodex/creatures/Ghoul.gif" },
  { slug: "bat", name: "Bat", image: "runescodex/creatures/Bat.gif" },
  { slug: "snake", name: "Snake", image: "runescodex/creatures/Snake.gif" },
  { slug: "wisp", name: "Wisp", image: "runescodex/creatures/Wisp.gif" },
  { slug: "hunter", name: "Hunter", image: "runescodex/creatures/Hunter.gif" },
  { slug: "poacher", name: "Poacher", image: "runescodex/creatures/Poacher.gif" },
  { slug: "amazon", name: "Amazon", image: "runescodex/creatures/Amazon.gif" },
  { slug: "marsh-stalker", name: "Marsh Stalker", image: "runescodex/creatures/Marsh_Stalker.gif" },
  { slug: "swampling", name: "Swampling", image: "runescodex/creatures/Swampling.gif" },
  { slug: "emerald-damselfly", name: "Emerald Damselfly", image: "runescodex/creatures/Emerald_Damselfly.gif" },
  { slug: "salamander", name: "Salamander", image: "runescodex/creatures/Salamander.gif" },
  { slug: "bonelord", name: "Bonelord", image: "runescodex/creatures/Bonelord.gif" },
  { slug: "crab", name: "Crab", image: "runescodex/creatures/Crab.gif" },
  { slug: "giant-spider", name: "Giant Spider", image: "runescodex/creatures/Giant_Spider.gif" },
  { slug: "brimstone-bug", name: "Brimstone Bug", image: "runescodex/creatures/Brimstone_Bug.gif" },
  { slug: "wailing-widow", name: "Wailing Widow", image: "runescodex/creatures/Wailing_Widow.gif" },
  { slug: "vile-grandmaster", name: "Vile Grandmaster", image: "runescodex/creatures/Vile_Grandmaster.gif" },
  { slug: "renegade-knight", name: "Renegade Knight", image: "runescodex/creatures/Renegade_Knight.gif" },
  { slug: "cult-scholar", name: "Cult Scholar", image: "runescodex/creatures/Cult_Scholar.gif" },
  { slug: "cult-enforcer", name: "Cult Enforcer", image: "runescodex/creatures/Cult_Enforcer.gif" },
  { slug: "vicious-squire", name: "Vicious Squire", image: "runescodex/creatures/Vicious_Squire.gif" },
  { slug: "cult-believer", name: "Cult Believer", image: "runescodex/creatures/Cult_Believer.gif" },
  { slug: "hive-overseer", name: "Hive Overseer", image: "runescodex/creatures/Hive_Overseer.gif" },
  { slug: "spidris-elite", name: "Spidris Elite", image: "runescodex/creatures/Spidris_Elite.gif" },
  { slug: "spidris", name: "Spidris", image: "runescodex/creatures/Spidris.gif" },
  { slug: "kollos", name: "Kollos", image: "runescodex/creatures/Kollos.gif" },
  { slug: "spitter", name: "Spitter", image: "runescodex/creatures/Spitter.gif" },
  { slug: "crawler", name: "Crawler", image: "runescodex/creatures/Crawler.gif" },
  { slug: "waspoid", name: "Waspoid", image: "runescodex/creatures/Waspoid.gif" },
  { slug: "insectoid-worker", name: "Insectoid Worker", image: "runescodex/creatures/Insectoid_Worker.gif" },
  { slug: "swarmer", name: "Swarmer", image: "runescodex/creatures/Swarmer.gif" },
  { slug: "ladybug", name: "Ladybug", image: "runescodex/creatures/Ladybug.gif" },
  { slug: "lesser-swarmer", name: "Lesser Swarmer", image: "runescodex/creatures/Lesser_Swarmer.gif" },
  { slug: "hive-pore", name: "Hive Pore", image: "runescodex/creatures/Hive_Pore.gif" },
] as const;
