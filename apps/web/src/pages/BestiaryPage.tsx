import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CharmGuidesPanel } from "../components/bestiary/CharmGuidesPanel";
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

type BestiaryTab = "guides" | "creatures";

export function BestiaryPage() {
  const navigate = useNavigate();
  const { activeCharacter, isAuthenticated, isRosterReady, user } = useAuth();
  const hasPremium = Boolean(user?.premium?.access);
  const requests = useLatestRequest();
  const [tab, setTab] = useState<BestiaryTab>("guides");
  const [queryDraft, setQueryDraft] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<BestiaryDifficultyFilter>("All");
  const [entries, setEntries] = useState<BestiaryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!isRosterReady || tab !== "creatures" || !hasPremium) return;
    void loadEntries(1);
  }, [hasPremium, isRosterReady, loadEntries, tab]);

  return (
    <div className="catalog-page catalog-page--bestiary">
      <section className="catalog-hero catalog-hero--bestiary" aria-labelledby="bestiary-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">RuneCodex · Bestiário</span>
          <h1 id="bestiary-title">BESTIÁRIO</h1>
          <p>
            Guias de Charm Points com sequência de criaturas e Hunts. Escolha seu objetivo e siga o
            caminho.
          </p>
          <CharacterSwitcher className="character-switcher--page" />
        </PageContainer>
      </section>

      <PageContainer className="catalog-body" size="wide">
        <nav className="bestiary-top-tabs" aria-label="Áreas do Bestiário">
          <button
            aria-selected={tab === "guides"}
            className={`bestiary-top-tab${tab === "guides" ? " is-active" : ""}`}
            onClick={() => setTab("guides")}
            type="button"
          >
            <span aria-hidden>✧</span> Guias de Charms
          </button>
          <button
            aria-selected={tab === "creatures"}
            className={`bestiary-top-tab${tab === "creatures" ? " is-active" : ""}`}
            disabled={!hasPremium}
            onClick={() => {
              if (!hasPremium) {
                navigate("/checkout");
                return;
              }
              setTab("creatures");
            }}
            title={hasPremium ? undefined : "Catálogo completo disponível no Premium"}
            type="button"
          >
            <span aria-hidden>▤</span> Todas as Criaturas
          </button>
        </nav>

        {tab === "guides" ? (
          <CharmGuidesPanel
            onPublish={() => {
              if (!hasPremium) {
                navigate("/checkout");
                return;
              }
              navigate("/bestiary/guides/new");
            }}
          />
        ) : !hasPremium ? (
          <CatalogEmpty
            description="O catálogo completo de criaturas faz parte do RuneCodex Premium."
            title="Premium necessário"
          />
        ) : (
          <>
            <div className="section-head">
              <div>
                <div className="section-kicker">Biblioteca completa</div>
                <h2>Todas as Criaturas</h2>
                <p>Consulte as criaturas e seus valores de Charm Points.</p>
              </div>
            </div>
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
                    <Link
                      className="catalog-card"
                      key={entry.id || entry.slug}
                      to={`/bestiary/${entry.slug}`}
                    >
                      <CatalogImage
                        alt=""
                        className="catalog-card__art"
                        name={entry.name}
                        src={entry.image}
                      />
                      <div className="catalog-card__body">
                        <div className="catalog-card__meta">
                          <Badge>Bestiário</Badge>
                          {entry.difficulty ? <Badge>{entry.difficulty}</Badge> : null}
                          {entry.charmPoints != null ? (
                            <Badge>{entry.charmPoints} CP</Badge>
                          ) : null}
                          {entry.progress?.completed ? (
                            <Badge tone="success">Completo</Badge>
                          ) : null}
                        </div>
                        <h2>{entry.name}</h2>
                        <p>
                          {[entry.location, entry.region].filter(Boolean).join(" · ") ||
                            "Local não informado"}
                        </p>
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
          </>
        )}
      </PageContainer>
    </div>
  );
}
