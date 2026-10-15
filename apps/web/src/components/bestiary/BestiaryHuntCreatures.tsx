import { CatalogImage } from "../catalog/CatalogImage";
import { formatEstimatedHours } from "../../domain/bestiary";
import type { HuntListItem } from "../../services/api/types";

type BestiaryHuntCreaturesProps = {
  hunt: HuntListItem;
  selectedSlug: string;
  togetherSlugs: Set<string>;
  selectedHours?: number | null;
};

export function BestiaryHuntCreatures({
  hunt,
  selectedSlug,
  togetherSlugs,
  selectedHours,
}: BestiaryHuntCreaturesProps) {
  if (!hunt.spawn.length) {
    return <p className="bestiary-creatures__empty">Nenhuma criatura cadastrada nesta hunt.</p>;
  }

  return (
    <div className="bestiary-creatures">
      {hunt.spawn.map((creature) => {
        const selected = creature.slug === selectedSlug;
        const together = Boolean(creature.slug && togetherSlugs.has(creature.slug));
        const time = selected ? formatEstimatedHours(selectedHours) : null;
        return (
          <div
            className={`bestiary-mini${selected ? " is-selected" : ""}${together ? " is-together" : ""}`}
            key={creature.slug || creature.name}
          >
            <CatalogImage alt="" className="bestiary-mini__art" name={creature.name} src={creature.image} />
            <span className="bestiary-mini__info">
              <span className="bestiary-mini__name">{creature.name}</span>
              {together && !selected ? <span className="bestiary-mini__tag">Junto</span> : null}
              {selected ? <span className="bestiary-mini__tag">Alvo</span> : null}
              {time ? <span className="bestiary-mini__time">{time}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
