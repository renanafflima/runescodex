import { useMemo, useState } from "react";
import { CatalogEmpty } from "../components/catalog/CatalogState";
import { BestiaryHuntCreatures } from "../components/bestiary/BestiaryHuntCreatures";
import { ButtonLink } from "../components/ui/Button";
import { Select } from "../components/ui/FormControls";
import {
  companionSlugSet,
  formatEstimatedHours,
  sortBestiaryHunts,
  type BestiaryHuntSort,
} from "../domain/bestiary";
import { huntSummary } from "../domain/hunts";
import { useBestiaryCreature } from "./BestiaryCreaturePage";

const SORT_OPTIONS = [
  { value: "level", label: "Ordenar por: Nível" },
  { value: "time", label: "Ordenar por: Tempo" },
  { value: "name", label: "Ordenar por: Nome" },
];

export function BestiaryHuntsPage() {
  const { entry, hunts } = useBestiaryCreature();
  const [sort, setSort] = useState<BestiaryHuntSort>("level");
  const together = companionSlugSet(entry);
  const ordered = useMemo(() => sortBestiaryHunts(hunts, sort), [hunts, sort]);
  const estimatedTime = formatEstimatedHours(entry.estimatedHours);

  return (
    <>
      <div className="bestiary-section-head">
        <div>
          <h2>Todas as hunts do {entry.name}</h2>
          <p>
            Locais cadastrados em que o {entry.name} aparece, com os dados disponíveis de nível, XP,
            lucro e criaturas da hunt.
          </p>
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
                  {estimatedTime ? (
                    <div>
                      <small>Tempo</small>
                      <strong>{estimatedTime}</strong>
                    </div>
                  ) : null}
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
                  selectedHours={entry.estimatedHours}
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
        <strong>Estimativa de Bestiário:</strong> o tempo exibido é o estimado da criatura
        selecionada. Não há duração cadastrada por hunt; a ordenação por tempo usa o nível
        recomendado enquanto esse campo não existir.
      </p>
    </>
  );
}
