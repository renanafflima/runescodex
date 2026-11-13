import { useMemo, useState } from "react";
import { CatalogImage } from "../catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { ButtonLink } from "../ui/Button";
import { SearchInput } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import {
  bossCombatStrategyText,
  bossLootText,
  filterBosstiary,
  formatBosstiaryLocationLine,
  formatBosstiaryReachLine,
  type BosstiaryEntry,
} from "../../domain/bosstiary";

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
        <p>Perfis sincronizados do Bosstiário revisado, com fallback no catálogo TibiaWiki quando necessário.</p>
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

      <Modal onClose={() => setSelectedSlug(null)} open={Boolean(selected)} title={selected?.name ?? "Boss"}>
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

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function BossDetail({ entry }: { entry: BosstiaryEntry }) {
  const loot = bossLootText(entry);
  const combatStrategy = bossCombatStrategyText(entry);
  const location = formatBosstiaryLocationLine(entry);
  const reach = formatBosstiaryReachLine(entry);
  const mechanics = entry.mechanics?.trim() || null;

  return (
    <div className="bosstiary-detail">
      <CatalogImage alt="" className="bosstiary-detail__art" name={entry.name} src={entry.imageUrl} />
      <dl>
        <DetailField
          label="Nível recomendado (Solo)"
          value={entry.recommendedLevelSolo != null ? String(entry.recommendedLevelSolo) : null}
        />
        <DetailField
          label="Nível recomendado (PT)"
          value={entry.recommendedLevelParty != null ? String(entry.recommendedLevelParty) : null}
        />
        <DetailField label="Recompensas / loot" value={loot} />
        <DetailField label="Localização" value={location} />
        <DetailField label="Como chegar / acesso" value={reach} />
        <DetailField label="Mecânicas" value={mechanics} />
        <DetailField label="Estratégia" value={combatStrategy} />
      </dl>
      <div className="bosstiary-detail__actions">
        <ButtonLink to={`/bosstiary/${entry.slug}`} variant="primary">
          Abrir ficha completa
        </ButtonLink>
      </div>
    </div>
  );
}
