import type { HuntCreature, HuntListItem } from "../services/api/types";
import { formatCount, hasNumericValue } from "./format";
import type { HuntCreatureBestiary } from "./hunt-bestiary";

export type BestiaryHuntSectionSummary = {
  totalCharmPoints: number;
  creaturesWithEntry: number;
  creaturesWithEstimatedTime: number;
  creatureCount: number;
};

export function formatBestiaryEstimatedDuration(hours: number | null | undefined) {
  if (!hasNumericValue(hours) || Number(hours) <= 0) {
    return "Tempo não estimado";
  }
  const value = Math.ceil(Number(hours));
  return `${value} ${value === 1 ? "hora" : "horas"}`;
}

export function huntSpawnCreature(hunt: HuntListItem, creatureSlug: string) {
  return hunt.spawn.find((creature) => creature.slug === creatureSlug) ?? null;
}

export function creatureKillPerHour(creature: HuntCreature) {
  if (hasNumericValue(creature.killPerHour) && Number(creature.killPerHour) > 0) {
    return Number(creature.killPerHour);
  }
  if (
    hasNumericValue(creature.bestiary.killsPerHourUsed) &&
    Number(creature.bestiary.killsPerHourUsed) > 0
  ) {
    return Number(creature.bestiary.killsPerHourUsed);
  }
  return null;
}

export function summarizeBestiaryHuntSection(hunt: HuntListItem): BestiaryHuntSectionSummary {
  const rows = hunt.spawn.map((creature) => creature.bestiary).filter((row) => row.hasEntry);
  return {
    totalCharmPoints: rows.reduce((sum, row) => sum + (row.charmPoints ?? 0), 0),
    creaturesWithEntry: rows.length,
    creaturesWithEstimatedTime: rows.filter(
      (row) => row.estimatedHours != null && row.estimatedHours > 0,
    ).length,
    creatureCount: hunt.spawn.length,
  };
}

export function summarizeBestiaryHuntsForCreature(
  hunts: HuntListItem[],
  creatureSlug: string,
) {
  let huntsWithEstimatedTime = 0;
  for (const hunt of hunts) {
    const creature = huntSpawnCreature(hunt, creatureSlug);
    if (
      creature?.bestiary.hasEntry &&
      creature.bestiary.estimatedHours != null &&
      creature.bestiary.estimatedHours > 0
    ) {
      huntsWithEstimatedTime += 1;
    }
  }
  return {
    huntCount: hunts.length,
    huntsWithEstimatedTime,
  };
}

export type BestiarySpawnStatLine = {
  key: string;
  text: string;
};

export function bestiarySpawnStatLines(creature: HuntCreature): BestiarySpawnStatLine[] {
  const bestiary: HuntCreatureBestiary = creature.bestiary;
  if (!bestiary.hasEntry) {
    return [{ key: "missing", text: "Bestiário não cadastrado" }];
  }

  const lines: BestiarySpawnStatLine[] = [];
  const killsRequired = formatCount(bestiary.killsRequired);
  if (killsRequired) {
    lines.push({ key: "kills", text: `${killsRequired} kills necessárias` });
  }
  const charmPoints = formatCount(bestiary.charmPoints);
  if (charmPoints) {
    lines.push({ key: "charms", text: `${charmPoints} Charm Points` });
  }
  const killPerHour = creatureKillPerHour(creature);
  if (killPerHour != null) {
    lines.push({ key: "kph", text: `${formatCount(killPerHour)} kills/h` });
  }
  lines.push({
    key: "time",
    text: `Tempo estimado: ${formatBestiaryEstimatedDuration(bestiary.estimatedHours)}`,
  });
  return lines;
}
