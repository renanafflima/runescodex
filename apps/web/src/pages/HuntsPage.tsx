import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CharacterSwitcher } from "../components/characters/CharacterSwitcher";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { ElementIcon } from "../components/ui/ElementIcon";
import { SearchInput } from "../components/ui/FormControls";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { assetUrl } from "../lib/assets";
import {
  ELEMENT_FILTERS,
  elementLabel,
  type CombatElement,
  type ElementFilter,
} from "../domain/elements";
import {
  filterAndSortHunts,
  HUNT_DIFFICULTIES,
  HUNT_VOCATION_FILTERS,
  huntListQueryFromFilters,
  huntSummary,
  mapHuntListItem,
  preferredHuntVocation,
  primaryAttackElement,
  primaryDefenseElement,
  type HuntDifficultyFilter,
  type HuntVocationFilter,
} from "../domain/hunts";
import { normalizeVocation } from "../domain/vocation";
import { describeApiError } from "../services/api/errors";
import { recordSearchMiss } from "../services/api/admin-portal";
import { CATALOG_PAGE_SIZE } from "../services/api/page";
import { listHuntsPage } from "../services/api/hunts";
import type { HuntListItem } from "../services/api/types";

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  render?: (option: T) => ReactNode;
}) {
  return (
    <div className="hunts-filter-group">
      <span className="hunts-filter-label">{label}</span>
      <div className="hunts-filter-pills">
        {options.map((option) => (
          <Chip
            active={value === option}
            className={option !== "Any" ? `hunts-pill hunts-pill--${option}` : "hunts-pill"}
            key={option}
            onClick={() => onChange(option)}
          >
            {render ? render(option) : option === "Any" ? "ANY" : option.replace(/_/g, " ")}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

export function HuntsPage() {
  const { activeCharacter, isRosterReady } = useAuth();
  const requests = useLatestRequest();
  const characterKey = activeCharacter?.id || "";
  const [vocationFilter, setVocationFilter] = useState<HuntVocationFilter>("Any");
  const [vocationTouchedFor, setVocationTouchedFor] = useState("");
  const vocationTouched = vocationTouchedFor === characterKey;
  const vocation: HuntVocationFilter = vocationTouched
    ? vocationFilter
    : normalizeVocation(activeCharacter?.vocation) || "Any";
  const [difficulty, setDifficulty] = useState<HuntDifficultyFilter>("Any");
  const [attackElement, setAttackElement] = useState<ElementFilter>("Any");
  const [defenseElement, setDefenseElement] = useState<ElementFilter>("Any");
  const [queryDraft, setQueryDraft] = useState("");
  const [search, setSearch] = useState("");
  const [hunts, setHunts] = useState<HuntListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(queryDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  const apiQuery = useMemo(
    () =>
      huntListQueryFromFilters({
        vocation,
        difficulty,
        character: activeCharacter,
        search,
      }),
    [activeCharacter, difficulty, search, vocation],
  );

  const loadHunts = useCallback(
    async (nextPage = 1) => {
      const current = requests.start();
      if (nextPage === 1) {
        setLoading(true);
        setError("");
        setHunts([]);
        setHasMore(false);
        setTotal(0);
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await listHuntsPage({
          ...apiQuery,
          page: nextPage,
          limit: CATALOG_PAGE_SIZE,
        });
        if (!current()) return;
        const preferred = preferredHuntVocation(vocation, activeCharacter);
        const mapped = result.items.map((hunt) => mapHuntListItem(hunt, preferred));
        setHunts((currentHunts) => (nextPage === 1 ? mapped : [...currentHunts, ...mapped]));
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setError("");
      } catch (err) {
        if (!current()) return;
        if (nextPage === 1) {
          setHunts([]);
          setTotal(0);
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
    [activeCharacter, apiQuery, requests, vocation],
  );

  useEffect(() => {
    if (!isRosterReady) return;
    void loadHunts(1);
  }, [isRosterReady, loadHunts]);

  const filtered = useMemo(
    () =>
      filterAndSortHunts(hunts, {
        query: "",
        vocation,
        attackElement,
        defenseElement,
        minXpH: "",
        minProfitH: "",
        minLevel: "",
        sortBy: "Best XP",
        character: activeCharacter,
      }),
    [activeCharacter, attackElement, defenseElement, hunts, vocation],
  );

  useEffect(() => {
    const term = search.trim();
    if (loading || term.length < 2 || filtered.length > 0) return;
    if (attackElement !== "Any" || defenseElement !== "Any") return;
    const timer = window.setTimeout(() => recordSearchMiss(term), 700);
    return () => window.clearTimeout(timer);
  }, [attackElement, defenseElement, filtered.length, loading, search]);

  return (
    <div className="hunts-list">
      <PageContainer className="hunts-list__page" size="wide">
        <span className="eyebrow">Hunts</span>
        <h1>Onde caçar agora</h1>
        <p className="hunts-list__subtitle">
          {activeCharacter
            ? `Encontre uma hunt para ${activeCharacter.name} · ${activeCharacter.vocation} ${activeCharacter.level} — pelo que você quer ganhar, ou pelo elemento que consegue enfrentar.`
            : "Encontre uma Hunt pelo que você quer ganhar — ou pelo elemento que você consegue enfrentar."}
        </p>
        <CharacterSwitcher className="character-switcher--page" />

        <div className="hunts-filters">
          <SearchInput
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Buscar hunt, criatura ou local"
            value={queryDraft}
          />
          <div className="hunts-filter-row">
            <FilterPills
              label="Vocação"
              onChange={(value) => {
                setVocationTouchedFor(characterKey);
                setVocationFilter(value);
              }}
              options={HUNT_VOCATION_FILTERS}
              value={vocation}
            />
            <FilterPills
              label="Elemento para atacar"
              onChange={setAttackElement}
              options={ELEMENT_FILTERS}
              render={(option) =>
                option === "Any" ? (
                  "ANY"
                ) : (
                  <span className="hunts-element-pill">
                    <ElementIcon element={option} />
                    {elementLabel(option as CombatElement)}
                  </span>
                )
              }
              value={attackElement}
            />
            <FilterPills
              label="Defesa"
              onChange={setDefenseElement}
              options={ELEMENT_FILTERS}
              render={(option) =>
                option === "Any" ? (
                  "ANY"
                ) : (
                  <span className="hunts-element-pill">
                    <ElementIcon element={option} />
                    {elementLabel(option as CombatElement)}
                  </span>
                )
              }
              value={defenseElement}
            />
            <FilterPills
              label="Dificuldade"
              onChange={setDifficulty}
              options={HUNT_DIFFICULTIES}
              value={difficulty}
            />
          </div>
        </div>

        <div className="hunts-results-head">
          <strong>
            {loading
              ? "Carregando hunts"
              : `${filtered.length} hunts nesta página${total > filtered.length ? ` · ${total} no filtro` : ""}`}
          </strong>
          <span>
            {activeCharacter
              ? `Ordenar: melhor combinação para ${activeCharacter.vocation} ${activeCharacter.level}`
              : "Ordenar: melhor XP"}
          </span>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando hunts" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void loadHunts(1)} />
        ) : filtered.length === 0 ? (
          <>
          <CatalogEmpty
            action={
              hasMore ? (
                <Button loading={loadingMore} onClick={() => void loadHunts(page + 1)} variant="secondary">
                  Carregar mais
                </Button>
              ) : (
                <Button onClick={() => void loadHunts(1)} variant="secondary">
                  Recarregar
                </Button>
              )
            }
            description={
              hunts.length === 0
                ? "A API não retornou hunts para os filtros atuais."
                : "Nenhuma hunt corresponde à busca ou aos filtros desta tela."
            }
            title="Nenhuma hunt encontrada"
          />
          </>
        ) : (
          <>
          <div className="hunts-grid">
            {filtered.map((hunt) => {
              const summary = huntSummary(hunt);
              const attack = primaryAttackElement(hunt);
              const defense = primaryDefenseElement(hunt);
              const shown = hunt.spawn.slice(0, 3);
              return (
                <Link className="hunt-card" key={hunt.id || hunt.slug} to={`/hunts/${hunt.slug}`}>
                  <div
                    className="hunt-card__hero"
                    style={{ backgroundImage: `url("${assetUrl("images/hunts/hunts_hero.webp")}")` }}
                  >
                    {hunt.creatureImage ? (
                      <img alt="" className="hunt-card__hero-creature" src={hunt.creatureImage} />
                    ) : null}
                    <div className="hunt-card__hero-top">
                      {summary.difficulty ? <span className="hunt-card__tag">{summary.difficulty}</span> : null}
                      {summary.level ? <span className="hunt-card__tag hunt-card__tag--level">{summary.level}</span> : null}
                    </div>
                    <div className="hunt-card__hero-title">
                      <h2>{hunt.name}</h2>
                      <p>{hunt.displayLocation || "Local não informado"}</p>
                    </div>
                  </div>
                  <div className="hunt-card__body">
                    <div className="hunt-card__metrics">
                      <div>
                        <small>XP / hora</small>
                        <b>{summary.xp || "—"}</b>
                      </div>
                      <div className="hunt-card__profit">
                        <small>Profit / hora</small>
                        <b>{summary.profit || "—"}</b>
                      </div>
                    </div>
                    <div className="hunt-card__combat">
                      <div className="hunt-card__combat-box">
                        <small>Melhor ataque</small>
                        {attack ? (
                          <span className="hunts-element-pill">
                            <ElementIcon element={attack} />
                            {elementLabel(attack)}
                          </span>
                        ) : (
                          <span>Não informado</span>
                        )}
                      </div>
                      <div className="hunt-card__combat-box">
                        <small>Atenção</small>
                        {defense ? (
                          <span className="hunts-element-pill">
                            <ElementIcon element={defense} />
                            {elementLabel(defense)}
                          </span>
                        ) : (
                          <span>Não informado</span>
                        )}
                      </div>
                    </div>
                    <div className="hunt-card__creatures">
                      <span>Principais:</span>
                      {shown.map((creature) =>
                        creature.image ? (
                          <img
                            alt={creature.name}
                            className="hunt-card__mini"
                            key={creature.slug || creature.name}
                            src={creature.image}
                            title={creature.name}
                          />
                        ) : (
                          <span key={creature.slug || creature.name}>{creature.name}</span>
                        ),
                      )}
                      {hunt.spawn.length > shown.length ? (
                        <span className="hunt-card__more">+{hunt.spawn.length - shown.length}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="hunt-card__open" aria-hidden="true">
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
          {hasMore ? (
            <div className="catalog-more">
              <Button
                loading={loadingMore}
                onClick={() => void loadHunts(page + 1)}
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
