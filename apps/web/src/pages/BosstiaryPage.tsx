import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Chip } from "../components/ui/Chip";
import { SearchInput } from "../components/ui/FormControls";
import { Modal } from "../components/ui/Modal";
import { loadBosstiaryCatalog, type BosstiaryCatalog } from "../domain/bosstiary-catalog";
import { recordContentView } from "../services/api/admin-portal";
import {
  BOSS_LEVELS,
  bossPartyLabel,
  filterBosstiary,
  type BossLevelFilter,
  type BossPartyFilter,
  type BosstiaryEntry,
} from "../domain/bosstiary";

const PARTY_FILTERS: Array<{ id: BossPartyFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "solo", label: "Solo" },
  { id: "party", label: "PT" },
  { id: "event", label: "Evento" },
];

export function BosstiaryPage() {
  const [catalog, setCatalog] = useState<BosstiaryCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [party, setParty] = useState<BossPartyFilter>("all");
  const [level, setLevel] = useState<BossLevelFilter>("all");
  const [params] = useSearchParams();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(params.get("boss"));

  function load() {
    setLoading(true);
    setError("");
    try {
      setCatalog(loadBosstiaryCatalog());
    } catch (err) {
      setCatalog(null);
      setError(err instanceof Error ? err.message : "Não foi possível ler o Bosstiário.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const entries = useMemo(() => catalog?.entries ?? [], [catalog]);
  const filtered = useMemo(
    () => filterBosstiary(entries, { query, party, level }),
    [entries, query, party, level],
  );
  const selected = entries.find((entry) => entry.slug === selectedSlug) ?? null;

  useEffect(() => {
    if (selected?.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selected.slug)) {
      recordContentView("BOSS", selected.slug);
    }
  }, [selected?.slug]);
  const classificationActive = party !== "all" || level !== "all";

  return (
    <div className="catalog-page catalog-page--bosstiary">
      <section className="catalog-hero catalog-hero--bosstiary" aria-labelledby="bosstiary-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">Bosstiário</span>
          <h1 id="bosstiary-title">Bosstiário</h1>
          <p>
            Enciclopédia de bosses separada do Bestiário. As faixas 300, 500, 700 e 1000 são
            recomendações editoriais do RuneCodex, não nível mínimo oficial do Tibia.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="catalog-body" size="wide">
        <p className="bosstiary-note">
          A lista inicial reúne candidatos da TibiaWiki com isboss = sim. Ela ainda não é o
          catálogo definitivo nem define Solo, PT, Evento, nível, loot, localização ou Boss Points.
        </p>

        <div className="catalog-filters">
          <SearchInput
            label="Buscar boss pelo nome"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar boss pelo nome"
            value={query}
          />
          <div className="chip-row" aria-label="Categoria do boss">
            {PARTY_FILTERS.map((item) => (
              <Chip active={party === item.id} key={item.id} onClick={() => setParty(item.id)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="chip-row" aria-label="Nível recomendado pelo RuneCodex">
            <Chip active={level === "all"} onClick={() => setLevel("all")}>
              Todas as faixas
            </Chip>
            {BOSS_LEVELS.map((item) => (
              <Chip active={level === item} key={item} onClick={() => setLevel(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando Bosstiário" />
        ) : error ? (
          <CatalogError description={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <CatalogEmpty
            description={
              classificationActive
                ? "Nenhum boss com classificação revisada corresponde a essa combinação de categoria e faixa."
                : "Nenhum boss corresponde à busca."
            }
            title="Nenhum boss encontrado"
          />
        ) : (
          <div className="catalog-grid catalog-grid--bestiary">
            {filtered.map((entry) => (
              <BossCard entry={entry} key={entry.slug} onOpen={() => setSelectedSlug(entry.slug)} />
            ))}
          </div>
        )}
      </PageContainer>

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
    </div>
  );
}

function BossCard({ entry, onOpen }: { entry: BosstiaryEntry; onOpen: () => void }) {
  const party = bossPartyLabel(entry.party);
  return (
    <button className="catalog-card bosstiary-card" onClick={onOpen} type="button">
      <CatalogImage alt="" className="catalog-card__art" name={entry.name} src={entry.imageUrl} />
      <div className="catalog-card__body">
        <div className="catalog-card__meta">
          <Badge tone={party ? "gold" : "neutral"}>{party ?? "Classificação pendente"}</Badge>
          {entry.recommendedLevel ? (
            <Badge tone="info">Recomendação RuneCodex · {entry.recommendedLevel}</Badge>
          ) : (
            <Badge>Nível não revisado</Badge>
          )}
        </div>
        <h2>{entry.name}</h2>
        <p>Candidato TibiaWiki · isboss = {entry.isboss}</p>
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
