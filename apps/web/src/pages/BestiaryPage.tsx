import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CharacterSwitcher } from "../components/characters/CharacterSwitcher";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { SearchInput } from "../components/ui/FormControls";
import { useLatestRequest } from "../hooks/useLatestRequest";
import {
  BESTIARY_DIFFICULTIES,
  bestiaryListQueryFromFilters,
  formatBestiaryKills,
  mapBestiaryEntry,
  type BestiaryDifficultyFilter,
} from "../domain/bestiary";
import { formatCount } from "../domain/format";
import { describeApiError } from "../services/api/errors";
import { listBestiaryPage } from "../services/api/bestiary";
import { CATALOG_PAGE_SIZE } from "../services/api/page";
import type { BestiaryEntry } from "../services/api/types";

const SEARCH_DEBOUNCE_MS = 300;

export function BestiaryPage() {
  const { activeCharacter, isAuthenticated, isRosterReady } = useAuth();
  const requests = useLatestRequest();
  const [queryDraft, setQueryDraft] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<BestiaryDifficultyFilter>("All");
  const [entries, setEntries] = useState<BestiaryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(queryDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  const loadEntries = useCallback(
    async (nextPage = 1) => {
      const current = requests.start();
      if (nextPage === 1) {
        setLoading(true);
        setError("");
        setEntries([]);
        setHasMore(false);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await listBestiaryPage(
          bestiaryListQueryFromFilters({
            difficulty,
            search,
            character: activeCharacter,
            page: nextPage,
            limit: CATALOG_PAGE_SIZE,
          }),
          isAuthenticated,
        );
        if (!current()) return;
        const mapped = result.items.map(mapBestiaryEntry);
        setEntries((currentEntries) => (nextPage === 1 ? mapped : [...currentEntries, ...mapped]));
        setPage(result.page);
        setHasMore(result.hasMore);
        setError("");
      } catch (err) {
        if (!current()) return;
        if (nextPage === 1) {
          setEntries([]);
          setHasMore(false);
        }
        setError(describeApiError(err));
      } finally {
        if (current()) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeCharacter, difficulty, isAuthenticated, requests, search],
  );

  useEffect(() => {
    if (!isRosterReady) return;
    void loadEntries(1);
  }, [isRosterReady, loadEntries]);

  return (
    <div className="catalog-page catalog-page--bestiary">
      <section className="catalog-hero catalog-hero--bestiary" aria-labelledby="bestiary-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">Bestiário</span>
          <h1 id="bestiary-title">Bestiário</h1>
          <p>
            Explore criaturas e planeje sua evolução de charms.
            {activeCharacter
              ? ` Criaturas das hunts de ${activeCharacter.name} · ${activeCharacter.vocation} ${activeCharacter.level} aparecem primeiro.`
              : isAuthenticated
                ? " O progresso de kills vem da sua conta quando a API o envia."
                : " Entre na conta para ver o progresso do bestiário."}
          </p>
          <CharacterSwitcher className="character-switcher--page" />
        </PageContainer>
      </section>

      <PageContainer className="catalog-body" size="wide">
        <div className="catalog-filters">
          <SearchInput
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Buscar criatura, local ou grupo"
            value={queryDraft}
          />
          <div className="chip-row" aria-label="Dificuldade">
            {BESTIARY_DIFFICULTIES.map((item) => (
              <Chip
                active={difficulty === item}
                key={item}
                onClick={() => setDifficulty(item)}
              >
                {item}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando bestiário" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void loadEntries(1)} />
        ) : entries.length === 0 ? (
          <CatalogEmpty
            action={
              <Button onClick={() => void loadEntries(1)} variant="secondary">
                Recarregar
              </Button>
            }
            description={
              search
                ? "Nenhuma criatura corresponde à busca."
                : "Não há criaturas para este filtro."
            }
            title="Nenhuma criatura encontrada"
          />
        ) : (
          <>
          <div className="catalog-grid catalog-grid--bestiary">
            {entries.map((entry) => (
              <Link className="catalog-card" key={entry.id || entry.slug} to={`/bestiary/${entry.slug}`}>
                <CatalogImage alt="" className="catalog-card__art" name={entry.name} src={entry.image} />
                <div className="catalog-card__body">
                  <div className="catalog-card__meta">
                    <Badge>Bestiário</Badge>
                    <Badge>Ver caminho →</Badge>
                    {entry.difficulty ? <Badge>{entry.difficulty}</Badge> : null}
                    {entry.progress?.completed ? <Badge tone="success">Completo</Badge> : null}
                  </div>
                  <h2>{entry.name}</h2>
                  <p>{[entry.location, entry.region].filter(Boolean).join(" · ") || "Local não informado"}</p>
                  <dl className="catalog-card__stats">
                    {formatCount(entry.hp) ? (
                      <div>
                        <dt>HP</dt>
                        <dd>{formatCount(entry.hp)}</dd>
                      </div>
                    ) : null}
                    {formatBestiaryKills(entry) ? (
                      <div>
                        <dt>Kills</dt>
                        <dd>{formatBestiaryKills(entry)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {entry.progress ? (
                    <div className="progress-track" aria-label={`Progresso ${entry.progress.progressPercentage}%`}>
                      <span style={{ width: `${Math.min(100, entry.progress.progressPercentage)}%` }} />
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
          {hasMore ? (
            <div className="catalog-more">
              <Button
                loading={loadingMore}
                onClick={() => void loadEntries(page + 1)}
                variant="secondary"
              >
                Carregar mais
              </Button>
            </div>
          ) : null}
          </>
        )}
      </PageContainer>
    </div>
  );
}
