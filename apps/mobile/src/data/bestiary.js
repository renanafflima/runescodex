const DIFFICULTY_LABEL = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  VERY_HARD: "Very Hard",
};

export function bestiaryCardFields(entry) {
  const location = Array.isArray(entry?.locations) ? entry.locations[0] : null;
  const killsPerHour = entry?.estimatedKillsPerHour ?? null;
  const bestiaryKills = entry?.killsRequired ?? null;
  const estimatedHours =
    entry?.estimatedHours ??
    (killsPerHour > 0 && bestiaryKills != null
      ? Math.ceil(bestiaryKills / killsPerHour)
      : null);

  return {
    id: entry?.id || entry?.slug || entry?.name || "",
    name: entry?.name || "",
    difficulty: DIFFICULTY_LABEL[entry?.difficulty] || "",
    location: location?.name || "",
    region: location?.region || "",
    hp: entry?.hp ?? null,
    killTogether: (entry?.together || [])
      .map((item) => item?.name)
      .filter(Boolean),
    bestiaryKills,
    killsPerHour,
    estimatedHours,
    youtubeUrl: entry?.youtubeUrl || null,
    weaknesses: (entry?.elements || [])
      .map((item) => (typeof item === "string" ? item : item?.element))
      .filter(Boolean),
    imagePath: entry?.image || "",
  };
}
