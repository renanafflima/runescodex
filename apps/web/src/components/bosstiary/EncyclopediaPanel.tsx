import { useMemo, useState } from "react";
import { CatalogImage } from "../catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { SearchInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import { bossPartyLabel, filterBosstiary, type BosstiaryEntry } from "../../domain/bosstiary";

type EncyclopediaPanelProps = {
  entries: BosstiaryEntry[];
  loading: boolean;
  error: string;
  onRetry: () => void;
};

export function EncyclopediaPanel({ entries, loading, error, onRetry }: EncyclopediaPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterBosstiary(entries, { query, party: "all", level: "all" }),
    [entries, query],
  );
  const selected = entries.find((entry) => entry.slug === selectedSlug) ?? null;

  return (
    <section className="bosstiary-encyclopedia" aria-labelledby="encyclopedia-title">
      <div className="bosstiary-section-title">
        <h2 id="encyclopedia-title">Enciclopédia</h2>
        <p>Consulte os bosses do catálogo visual. Os detalhes completos abrem ao selecionar um card.</p>
      </div>

      <div className="bosstiary-encyclopedia__filters">
        <SearchInput
          label="Buscar boss pelo nome"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar boss pelo nome"
          value={query}
        />
      </div>

      {loading ? (
        <CatalogLoading label="Carregando Bosstiário" />
      ) : error ? (
        <CatalogError description={error} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <CatalogEmpty description="Nenhum boss corresponde à busca." title="Nenhum boss encontrado" />
      ) : (
        <div className="catalog-grid catalog-grid--encyclopedia">
          {filtered.map((entry) => (
            <BossCard entry={entry} key={entry.slug} onOpen={() => setSelectedSlug(entry.slug)} />
          ))}
        </div>
      )}

      <Modal
        description={
          selected?.party
            ? "Recomendação editorial do RuneCodex, não requisito oficial do Tibia."
            : "Candidato da TibiaWiki. A classificação do RuneCodex ainda não foi revisada."
        }
        onClose={() => setSelectedSlug(null)}
        open={Boolean(selected)}
        title={selected?.name ?? "Boss"}
      >
        {selected ? <BossDetail entry={selected} /> : null}
      </Modal>
    </section>
  );
}

function BossCard({ entry, onOpen }: { entry: BosstiaryEntry; onOpen: () => void }) {
  return (
    <button className="catalog-card bosstiary-card bosstiary-card--simple" onClick={onOpen} type="button">
      <CatalogImage alt="" className="catalog-card__art" name={entry.name} src={entry.imageUrl} />
      <div className="catalog-card__body">
        <h2>{entry.name}</h2>
      </div>
    </button>
  );
}

function BossDetail({ entry }: { entry: BosstiaryEntry }) {
  const party = bossPartyLabel(entry.party);
  return (
    <div className="bosstiary-detail">
      <CatalogImage alt="" className="bosstiary-detail__art" name={entry.name} src={entry.imageUrl} />
      <dl>
        <div>
          <dt>Fonte</dt>
          <dd>
            <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
              TibiaWiki
            </a>
            {" · "}isboss = {entry.isboss}
          </dd>
        </div>
        <div>
          <dt>Categoria</dt>
          <dd>{party ?? "Solo, PT ou Evento ainda não revisados."}</dd>
        </div>
        <div>
          <dt>Nível recomendado</dt>
          <dd>
            {entry.recommendedLevel
              ? `Recomendação do RuneCodex: ${entry.recommendedLevel}. Não é nível mínimo oficial.`
              : "Sem recomendação revisada do RuneCodex."}
          </dd>
        </div>
        <div>
          <dt>Recompensas</dt>
          <dd>
            {entry.rewards.length === 0 ? (
              "Nenhuma recompensa cadastrada."
            ) : (
              <ul className="bosstiary-rewards">
                {entry.rewards.map((reward) => (
                  <li key={reward.name}>
                    <CatalogImage alt="" name={reward.name} src={reward.imageUrl} />
                    <span>{reward.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt>Localização</dt>
          <dd>{entry.location ?? "Localização ainda não cadastrada."}</dd>
        </div>
        <div>
          <dt>Boss Points</dt>
          <dd>
            {entry.bossPoints == null
              ? "Sem fonte de Boss Points no RuneCodex."
              : entry.bossPoints}
          </dd>
        </div>
      </dl>
    </div>
  );
}
