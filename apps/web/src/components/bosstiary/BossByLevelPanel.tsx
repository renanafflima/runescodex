import { useState } from "react";
import { CatalogEmpty } from "../catalog/CatalogState";
import { Chip } from "../ui/Chip";
import { BossCatalogCard } from "./BossCatalogCard";
import {
  BOSS_LEVELS,
  bossesForLevelBand,
  type BossLevel,
  type BosstiaryEntry,
} from "../../domain/bosstiary";
import { BOSSTIARY_LEVEL_JOURNEYS } from "../../domain/bosstiary-rotations";

type BossByLevelPanelProps = {
  entries: BosstiaryEntry[];
};

export function BossByLevelPanel({ entries }: BossByLevelPanelProps) {
  const [level, setLevel] = useState<BossLevel>(500);
  const journey = BOSSTIARY_LEVEL_JOURNEYS.find((item) => item.level === level);
  const solo = bossesForLevelBand(entries, "solo", level);
  const party = bossesForLevelBand(entries, "party", level);

  return (
    <section className="bosstiary-by-level" aria-labelledby="level-title">
      <div className="bosstiary-section-title">
        <h2 id="level-title">Boss por level</h2>
        <p>{journey?.blurb ?? "Recomendações editoriais do RuneCodex por faixa de level."}</p>
      </div>

      <div className="chip-row" aria-label="Faixa de level">
        {BOSS_LEVELS.map((item) => (
          <Chip active={level === item} key={item} onClick={() => setLevel(item)}>
            {item}
          </Chip>
        ))}
      </div>

      <div className="bosstiary-by-level__columns">
        <div>
          <h3>Solo</h3>
          {solo.length === 0 ? (
            <CatalogEmpty
              description="Nenhum boss solo com classificação revisada nesta faixa."
              title="Sem bosses solo"
            />
          ) : (
            <div className="catalog-grid catalog-grid--bestiary">
              {solo.map((entry) => (
                <BossCatalogCard entry={entry} key={entry.slug} />
              ))}
            </div>
          )}
        </div>
        <div>
          <h3>Grupo</h3>
          {party.length === 0 ? (
            <CatalogEmpty
              description="Nenhum boss de grupo com classificação revisada nesta faixa."
              title="Sem bosses de grupo"
            />
          ) : (
            <div className="catalog-grid catalog-grid--bestiary">
              {party.map((entry) => (
                <BossCatalogCard entry={entry} key={entry.slug} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
