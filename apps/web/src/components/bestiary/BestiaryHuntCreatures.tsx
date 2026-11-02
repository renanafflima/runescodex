import { CatalogImage } from "../catalog/CatalogImage";
import { bestiarySpawnStatLines } from "../../domain/bestiary-hunt";
import type { HuntListItem } from "../../services/api/types";

type BestiaryHuntCreaturesProps = {
  hunt: HuntListItem;
  selectedSlug: string;
  togetherSlugs: Set<string>;
};

export function BestiaryHuntCreatures({
  hunt,
  selectedSlug,
  togetherSlugs,
}: BestiaryHuntCreaturesProps) {
  if (!hunt.spawn.length) {
    return <p className="bestiary-creatures__empty">Nenhuma criatura cadastrada nesta hunt.</p>;
  }

  return (
    <div className="bestiary-creatures">
      {hunt.spawn.map((creature) => {
        const selected = creature.slug === selectedSlug;
        const together = Boolean(creature.slug && togetherSlugs.has(creature.slug));
        const stats = bestiarySpawnStatLines(creature);
        return (
          <article
            className={`bestiary-spawn${selected ? " is-selected" : ""}${together ? " is-together" : ""}`}
            key={creature.slug || creature.name}
          >
            <CatalogImage alt="" className="bestiary-spawn__art" name={creature.name} src={creature.image} />
            <div className="bestiary-spawn__body">
              <div className="bestiary-spawn__head">
                <h4 className="bestiary-spawn__name">{creature.name}</h4>
                {together && !selected ? <span className="bestiary-spawn__tag">Junto</span> : null}
                {selected ? <span className="bestiary-spawn__tag">Alvo</span> : null}
              </div>
              <ul className="bestiary-spawn__stats">
                {stats.map((line) => (
                  <li key={line.key}>{line.text}</li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </div>
  );
}
