export const huntsBackground = require("@/assets/runescodex/hunts/hunts_background.webp");
export const huntsHero = require("@/assets/runescodex/hunts/hunts_hero.webp");

export const DAMAGE_ICONS = {
  death: require("@/assets/runescodex/icons/death.webp"),
  energy: require("@/assets/runescodex/icons/energy.webp"),
  fire: require("@/assets/runescodex/icons/fire.webp"),
  holy: require("@/assets/runescodex/icons/holy.webp"),
  ice: require("@/assets/runescodex/icons/ice.webp"),
  physical: require("@/assets/runescodex/icons/phisical.webp"),
  poison: require("@/assets/runescodex/icons/poison.webp"),
};

const MAP_CYCLOPS = require("@/assets/maps/cyclops.png");
const MAP_DRAGON = require("@/assets/maps/dragon.png");
const MAP_HYDRA = require("@/assets/maps/hydra.png");
const MAP_DEMON = require("@/assets/maps/demon.png");

export const MAPS = {
  Cyclops: MAP_CYCLOPS,
  Dragon: MAP_DRAGON,
  Hydra: MAP_HYDRA,
  Demon: MAP_DEMON,
  "cyclops.png": MAP_CYCLOPS,
  "dragon.png": MAP_DRAGON,
  "hydra.png": MAP_HYDRA,
  "demon.png": MAP_DEMON,
};

const CREATURE_IMAGES = {
  Cyclops: require("@/assets/runescodex/creatures/Cyclops.gif"),
  "Cyclops Smith": require("@/assets/runescodex/creatures/Cyclops_Smith.gif"),
  "Cyclops Drone": require("@/assets/runescodex/creatures/Cyclops_Drone.gif"),
  Dragon: require("@/assets/runescodex/creatures/Dragon.gif"),
  "Dragon Hatchling": require("@/assets/runescodex/creatures/Dragon_Hatchling.gif"),
  "Dragon Lord Hatchling": require("@/assets/runescodex/creatures/Dragon_Lord_Hatchling.gif"),
  Hydra: require("@/assets/runescodex/creatures/Hydra.gif"),
  "Serpent Spawn": require("@/assets/runescodex/creatures/Serpent_Spawn.gif"),
  Medusa: require("@/assets/runescodex/creatures/Medusa.gif"),
  Demon: require("@/assets/runescodex/creatures/Demon.gif"),
  "Grim Reaper": require("@/assets/runescodex/creatures/Grim_Reaper.gif"),
  Hellhound: require("@/assets/runescodex/creatures/Hellhound.gif"),
  "Fire Elemental": require("@/assets/runescodex/creatures/Fire_Elemental.gif"),
};

export const PTS = [1, 2, 3, 4];
export const VOCS = ["Any", "EK", "RP", "MS", "ED"];
export const DIFFICULTIES = ["Any", "EASY", "MEDIUM", "HARD", "VERY_HARD"];
export const SORTS = ["Best XP", "Best Profit", "Level", "Name"];

export const HUNTS = [
  {
    id: "h1",
    name: "Cyclops Hunt",
    creature: "Cyclops",
    creatureImage: CREATURE_IMAGES.Cyclops,
    location: "Thais - Cyclops Cave",
    xpH: 180000,
    profitH: 30000,
    levelMin: 40,
    vocation: "EK",
    recommendedDamage: "Physical / Energy (arma + suporte)",
    heroImage: null,
    spawn: [
      { name: "Cyclops", image: CREATURE_IMAGES.Cyclops, weaknesses: ["Physical", "Energy"] },
      { name: "Cyclops Smith", image: CREATURE_IMAGES["Cyclops Smith"], weaknesses: ["Physical"] },
      { name: "Cyclops Drone", image: CREATURE_IMAGES["Cyclops Drone"], weaknesses: ["Physical"] },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+cyclops+hunt",
    loot: [],
    communityTips: [],
  },
  {
    id: "h2",
    name: "Dragon Hunt",
    creature: "Dragon",
    creatureImage: CREATURE_IMAGES.Dragon,
    location: "Darashia - Dragon Lair",
    xpH: 450000,
    profitH: 60000,
    levelMin: 80,
    vocation: "MS",
    recommendedDamage: "Ice / Physical (Avalanche/SD conforme voc)",
    heroImage: null,
    spawn: [
      { name: "Dragon", image: CREATURE_IMAGES.Dragon, weaknesses: ["Ice"] },
      { name: "Dragon Hatchling", image: CREATURE_IMAGES["Dragon Hatchling"], weaknesses: ["Ice"] },
      { name: "Dragon Lord Hatchling", image: CREATURE_IMAGES["Dragon Lord Hatchling"], weaknesses: ["Ice"] },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+dragon+hunt",
    loot: [],
    communityTips: [],
  },
  {
    id: "h3",
    name: "Hydra Hunt",
    creature: "Hydra",
    creatureImage: CREATURE_IMAGES.Hydra,
    location: "Tiquanda - Hydra Cave",
    xpH: 900000,
    profitH: 120000,
    levelMin: 150,
    vocation: "RP",
    recommendedDamage: "Ice / Energy (Avalanche/GFB + set)",
    heroImage: null,
    spawn: [
      { name: "Hydra", image: CREATURE_IMAGES.Hydra, weaknesses: ["Ice", "Energy"] },
      { name: "Serpent Spawn", image: CREATURE_IMAGES["Serpent Spawn"], weaknesses: ["Ice"] },
      { name: "Medusa", image: CREATURE_IMAGES.Medusa, weaknesses: ["Energy"] },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+hydra+hunt",
    loot: [],
    communityTips: [],
  },
  {
    id: "h4",
    name: "Demon Hunt",
    creature: "Demon",
    creatureImage: CREATURE_IMAGES.Demon,
    location: "Edron - Demon Pits",
    xpH: 1200000,
    profitH: 180000,
    levelMin: 250,
    vocation: "ED",
    recommendedDamage: "Holy / Ice (SD + suporte)",
    heroImage: null,
    spawn: [
      { name: "Demon", image: CREATURE_IMAGES.Demon, weaknesses: ["Holy", "Ice"], bestCharm: "Freeze" },
      { name: "Grim Reaper", image: CREATURE_IMAGES["Grim Reaper"], weaknesses: ["Energy"], bestCharm: "Zap" },
      { name: "Hellhound", image: CREATURE_IMAGES.Hellhound, weaknesses: ["Ice"] },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+demon+hunt",
    loot: [],
    communityTips: [],
  },
];

export function getHuntById(id) {
  return HUNTS.find((hunt) => hunt.id === id) || null;
}

function fileNameFromPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1];
}

export function resolveCreatureImage(image, name) {
  if (image && typeof image === "object") return image;
  const fileName = fileNameFromPath(image);
  if (fileName && CREATURE_IMAGES[fileName]) return CREATURE_IMAGES[fileName];
  if (name && CREATURE_IMAGES[name]) return CREATURE_IMAGES[name];
  const fromFileName = fileName.replace(/_/g, " ").replace(/\.gif$/i, "");
  if (fromFileName && CREATURE_IMAGES[fromFileName]) return CREATURE_IMAGES[fromFileName];
  return null;
}

export function resolveMapImage(mapImage, creatureName) {
  const fileName = fileNameFromPath(mapImage);
  if (fileName && MAPS[fileName]) return MAPS[fileName];
  if (creatureName && MAPS[creatureName]) return MAPS[creatureName];
  return null;
}

export function formatHuntLocation(location, subLocation) {
  return [location, subLocation].filter(Boolean).join(" - ");
}

export function formatDifficultyLabel(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

export function formatCharmLabel(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ");
}

export function formatLevelRange(levelMin, levelMax) {
  if (levelMin == null && levelMax == null) return null;
  if (levelMin != null && levelMax != null && Number(levelMin) !== Number(levelMax)) {
    return `${levelMin}–${levelMax}`;
  }
  if (levelMin != null) return `${levelMin}+`;
  return `≤${levelMax}`;
}

export function pickHuntVocation(vocations, preferred) {
  const list = Array.isArray(vocations) ? vocations : [];
  if (preferred && preferred !== "Any") {
    const match = list.find((item) => item.vocation === preferred);
    if (match) return match;
  }
  return list.find((item) => item.isRecommended) || list[0] || null;
}

function elementTypes(elements) {
  return (elements || [])
    .map((item) => (typeof item === "string" ? item : item?.element))
    .filter(Boolean);
}

function mapVocations(vocations) {
  return (Array.isArray(vocations) ? vocations : []).map((item) => ({
    vocation: item?.vocation || null,
    isRecommended: Boolean(item?.isRecommended),
    levelMin: item?.levelMin ?? null,
    levelMax: item?.levelMax ?? null,
    xpPerHour: item?.xpPerHour ?? null,
    profitPerHour: item?.profitPerHour ?? null,
    difficulty: item?.difficulty || null,
    notes: item?.notes || null,
  }));
}

function mapHuntCreature(item) {
  const nested = item?.creature && typeof item.creature === "object" ? item.creature : null;
  const source = nested || item || {};
  return {
    id: item?.id || source.id || source.slug || source.name || null,
    name: source.name || item?.name || "",
    image: resolveCreatureImage(source.image || item?.image, source.name || item?.name),
    hp: nested ? nested.hp ?? null : item?.hp ?? null,
    xp: nested ? nested.experience ?? null : item?.experience ?? item?.xp ?? null,
    elements: elementTypes(nested?.elements || item?.elements),
    recommendedCharm: item?.recommendedCharm || null,
    damageType: item?.damageType || null,
    isPrimary: Boolean(item?.isPrimary),
    quantity: item?.quantity ?? null,
    notes: item?.notes || null,
  };
}

function mapHuntVideos(videos) {
  return (Array.isArray(videos) ? videos : [])
    .filter((item) => item?.url)
    .map((item) => ({
      id: item.id || item.url,
      title: item.title || null,
      url: item.url,
      channel: item.channel || null,
      isRecommended: Boolean(item.isRecommended),
    }));
}

function mapHuntLoot(loot) {
  return (Array.isArray(loot) ? loot : [])
    .filter((item) => item?.itemName)
    .map((item) => ({
      id: item.id || item.itemName,
      itemName: item.itemName,
      image: resolveCreatureImage(item.itemImage),
      estimatedValue: item.estimatedValue ?? null,
      importance: item.importance || null,
    }));
}

export function mapHuntListItem(hunt, preferredVocation) {
  const vocations = mapVocations(hunt?.vocations);
  const vocation = pickHuntVocation(vocations, preferredVocation);
  const spawn = (hunt?.creatures || []).map(mapHuntCreature);
  const primary = spawn.find((item) => item.isPrimary) || spawn[0] || null;
  const videos = mapHuntVideos(hunt?.videos);
  return {
    id: hunt.id,
    slug: hunt.slug,
    name: hunt.name,
    location: hunt.location || null,
    subLocation: hunt.subLocation || null,
    displayLocation: formatHuntLocation(hunt.location, hunt.subLocation),
    difficulty: hunt.difficulty || null,
    respawn: hunt.respawn || null,
    vocations,
    creature: primary?.name || "",
    creatureImage: primary?.image || null,
    xpH: vocation?.xpPerHour ?? null,
    profitH: vocation?.profitPerHour ?? null,
    levelMin: vocation?.levelMin ?? null,
    levelMax: vocation?.levelMax ?? null,
    vocation: vocation?.vocation || null,
    spawn,
    mapImage: hunt.mapImage || null,
    youtubeUrl: videos.find((item) => item.isRecommended)?.url || videos[0]?.url || null,
  };
}

export function mapHuntDetail(hunt, preferredVocation) {
  const vocations = mapVocations(hunt?.vocations);
  const vocation = pickHuntVocation(vocations, preferredVocation);
  const spawn = (hunt?.creatures || []).map(mapHuntCreature);
  const primary = spawn.find((item) => item.isPrimary) || spawn[0] || null;
  const videos = mapHuntVideos(hunt?.videos);
  return {
    id: hunt.id,
    slug: hunt.slug,
    name: hunt.name,
    location: hunt.location || null,
    subLocation: hunt.subLocation || null,
    displayLocation: formatHuntLocation(hunt.location, hunt.subLocation),
    difficulty: hunt.difficulty || null,
    respawn: hunt.respawn || null,
    description: hunt.description || null,
    creature: primary?.name || "",
    creatureImage: primary?.image || null,
    heroImage: hunt.heroImage ? resolveCreatureImage(hunt.heroImage) : null,
    mapImage: hunt.mapImage || null,
    vocations,
    xpH: vocation?.xpPerHour ?? null,
    profitH: vocation?.profitPerHour ?? null,
    levelMin: vocation?.levelMin ?? null,
    levelMax: vocation?.levelMax ?? null,
    vocation: vocation?.vocation || null,
    spawn,
    videos,
    youtubeUrl: videos.find((item) => item.isRecommended)?.url || videos[0]?.url || null,
    loot: mapHuntLoot(hunt?.loot),
  };
}

export function getHuntHero(hunt) {
  return hunt?.heroImage || huntsHero;
}

export function damageKey(type) {
  const raw = String(type || "").trim().toLowerCase();
  if (raw === "earth" || raw === "poison") return "poison";
  if (raw === "curse" || raw === "death") return "death";
  if (raw === "physical") return "physical";
  if (raw === "energy") return "energy";
  if (raw === "fire") return "fire";
  if (raw === "holy") return "holy";
  if (raw === "ice") return "ice";
  return null;
}

export function damageIcon(type) {
  const key = damageKey(type);
  return key ? DAMAGE_ICONS[key] : null;
}

const CHARM_ICON_KEYS = {
  wound: "physical",
  poison: "poison",
  enflame: "fire",
  freeze: "ice",
  zap: "energy",
  curse: "death",
  divine_wrath: "holy",
};

export function charmIcon(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const key = CHARM_ICON_KEYS[raw];
  return key ? DAMAGE_ICONS[key] : null;
}

export function formatElementLabel(value) {
  return formatCharmLabel(value);
}

export function huntElements(hunt) {
  const seen = [];
  (hunt?.spawn || []).forEach((creature) => {
    (creature.elements || creature.weaknesses || []).forEach((type) => {
      const key = damageKey(type);
      if (key && !seen.includes(key)) seen.push(key);
    });
  });
  return seen;
}

export function hasNumericValue(n) {
  if (n == null || n === "") return false;
  return Number.isFinite(Number(n));
}

export function formatRate(n) {
  if (!hasNumericValue(n)) return null;
  const value = Number(n);
  if (value >= 1000000) {
    const compact = value / 1000000;
    return `${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1).replace(".", ",")}M`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

export function formatCount(n) {
  if (!hasNumericValue(n)) return null;
  return String(Math.round(Number(n)));
}

export function toNumberOrNull(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function clampPT(n) {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}
