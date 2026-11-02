import { useMemo, useState } from "react";
import { CatalogEmpty } from "../components/catalog/CatalogState";
import { BestiaryHuntCreatures } from "../components/bestiary/BestiaryHuntCreatures";
import { ButtonLink } from "../components/ui/Button";
import { Select } from "../components/ui/FormControls";
import {
  companionSlugSet,
  sortBestiaryHunts,
  type BestiaryHuntSort,
} from "../domain/bestiary";
import {
  formatBestiaryEstimatedDuration,
  huntSpawnCreature,
  summarizeBestiaryHuntSection,
  summarizeBestiaryHuntsForCreature,
} from "../domain/bestiary-hunt";
import { huntSummary } from "../domain/hunts";
import { useAuth } from "../auth/AuthContext";
import { CharacterSwitcher } from "../components/characters/CharacterSwitcher";
import { useBestiaryCreature } from "./BestiaryCreaturePage";

const SORT_OPTIONS = [
  { value: "level", label: "Ordenar por: Nível" },
  { value: "time", label: "Ordenar por: Tempo" },
  { value: "name", label: "Ordenar por: Nome" },
];

export function BestiaryHuntsPage() {
  const { entry, hunts } = useBestiaryCreature();
  const { activeCharacter } = useAuth();
  const [sort, setSort] = useState<BestiaryHuntSort>("level");
  const together = companionSlugSet(entry);
  const ordered = useMemo(
    () => sortBestiaryHunts(hunts, sort, activeCharacter, entry.slug),
    [activeCharacter, entry.slug, hunts, sort],
  );
  const huntTimeSummary = useMemo(
    () => summarizeBestiaryHuntsForCreature(hunts, entry.slug),
    [entry.slug, hunts],
  );

  return (
    <>
      <div className="bestiary-section-head">
        <div>
          <h2>Todas as hunts do {entry.name}</h2>
          <p>
            Locais cadastrados em que o {entry.name} aparece, com kills, Charm Points, taxa da hunt e
            tempo estimado por criatura.
            {activeCharacter
              ? ` Hunts de ${activeCharacter.vocation} ${activeCharacter.level} aparecem primeiro.`
              : ""}
            {huntTimeSummary.huntsWithEstimatedTime
              ? ` Tempo calculável em ${huntTimeSummary.huntsWithEstimatedTime}/${huntTimeSummary.huntCount} hunts.`
              : ""}
          </p>
          <CharacterSwitcher className="character-switcher--page" id="bestiary-hunt-character" />
        </div>
        <Select
          aria-label="Ordenar hunts"
          label="Ordenação"
          onChange={(event) => setSort(event.target.value as BestiaryHuntSort)}
          options={SORT_OPTIONS}
          value={sort}
        />
      </div>

      {ordered.length === 0 ? (
        <CatalogEmpty
          description="A API não retornou hunts com esta criatura."
          title="Nenhuma hunt encontrada"
        />
      ) : (
        <div className="bestiary-hunts">
          {ordered.map((hunt, index) => {
            const summary = huntSummary(hunt);
            const selectedCreature = huntSpawnCreature(hunt, entry.slug);
            const sectionSummary = summarizeBestiaryHuntSection(hunt);
            const selectedTime = formatBestiaryEstimatedDuration(
              selectedCreature?.bestiary.estimatedHours,
            );
            return (
              <article className="bestiary-hunt" key={hunt.id || hunt.slug}>
                <span className="bestiary-hunt__number">{index + 1}</span>
                <h3>{hunt.name}</h3>
                <p className="bestiary-hunt__place">
                  {[hunt.displayLocation, summary.level ? `Nível ${summary.level}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Local não informado"}
                </p>
                <div className="bestiary-hunt__stats">
                  {selectedCreature?.bestiary.hasEntry ? (
                    <div>
                      <small>{entry.name}</small>
                      <strong>{selectedTime}</strong>
                    </div>
                  ) : null}
                  <div>
                    <small>Charm Points (hunt)</small>
                    <strong>{sectionSummary.totalCharmPoints}</strong>
                  </div>
                  <div>
                    <small>Com tempo</small>
                    <strong>
                      {sectionSummary.creaturesWithEstimatedTime}/{sectionSummary.creaturesWithEntry}
                    </strong>
                  </div>
                  {summary.xp ? (
                    <div>
                      <small>XP/h</small>
                      <strong>{summary.xp}</strong>
                    </div>
                  ) : null}
                  {summary.profit ? (
                    <div>
                      <small>Profit/h</small>
                      <strong>{summary.profit}</strong>
                    </div>
                  ) : null}
                </div>
                <div className="bestiary-hunt__creatures-label">
                  Criaturas nesta hunt ({hunt.spawn.length})
                </div>
                <BestiaryHuntCreatures
                  hunt={hunt}
                  selectedSlug={entry.slug}
                  togetherSlugs={together}
                />
                <div className="bestiary-hunt__actions">
                  <ButtonLink fullWidth to={`/hunts/${hunt.slug}`}>
                    Ir para a hunt →
                  </ButtonLink>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="bestiary-foot">
        <strong>Estimativa de Bestiário:</strong> o tempo usa{" "}
        <code>killsRequired ÷ killPerHour</code> da relação HuntCreature. Cada criatura na hunt
        mostra sua própria estimativa; os tempos não são somados, pois várias criaturas são mortas
        em paralelo.
      </p>
    </>
  );
}
