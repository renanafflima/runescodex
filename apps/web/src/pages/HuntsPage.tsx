import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CharacterSwitcher } from "../components/characters/CharacterSwitcher";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { ElementIcon } from "../components/ui/ElementIcon";
import { Icon, type IconName } from "../components/ui/Icon";
import { Pagination } from "../components/ui/Pagination";
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
  HUNT_SORTS,
  HUNT_VOCATION_FILTERS,
  huntAttackElements,
  huntDefenseElements,
  huntListQueryFromFilters,
  huntLocationOptions,
  huntSummary,
  mapHuntListItem,
  preferredHuntVocation,
  type HuntDifficultyFilter,
  type HuntSort,
  type HuntVocationFilter,
} from "../domain/hunts";
import { formatHuntCardBestiaryLines } from "../domain/hunt-bestiary";
import { normalizeVocation } from "../domain/vocation";
import { describeApiError } from "../services/api/errors";
import { recordSearchMiss } from "../services/api/admin-portal";
import { CATALOG_PAGE_SIZE } from "../services/api/page";
import { listHuntsPage } from "../services/api/hunts";
import type { HuntListItem } from "../services/api/types";

const HUNT_DIFFICULTY_LABEL: Record<string, string> = {
  Any: "Todas",
  EASY: "Fácil",
  MEDIUM: "Média",
  HARD: "Difícil",
  VERY_HARD: "Muito difícil",
};

const HUNT_VOCATION_LABEL: Record<string, string> = {
  Any: "Todas",
  EK: "Knight",
  RP: "Paladin",
  ED: "Druid",
  MS: "Sorcerer",
  EM: "Monk",
};

const HUNT_SORT_LABEL: Record<HuntSort, string> = {
  "Best XP": "Melhor XP",
  "Best Profit": "Melhor Profit",
  Level: "Nível",
  Name: "Nome",
};

const HUNT_LEVEL_FILTERS = ["Any", "50", "100", "150", "250", "400", "600", "800"] as const;
type HuntLevelFilter = (typeof HUNT_LEVEL_FILTERS)[number];

const DIFFICULTY_TONE: Record<string, string> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  VERY_HARD: "very-hard",
};

function difficultyToneClass(difficulty: string | null) {
  const tone = difficulty ? DIFFICULTY_TONE[difficulty] : null;
  return tone ? `hunt-card__tag--${tone}` : "";
}

function FilterSelect<T extends string>({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: IconName;
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  return (
    <label className="hunts-select">
      <Icon className="hunts-select__icon" name={icon} size={15} />
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {label}: {option.label}
          </option>
        ))}
      </select>
      <Icon className="hunts-select__chevron" name="chevron-right" size={12} />
    </label>
  );
}

function ElementChipRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: ElementFilter) => void;
  value: ElementFilter;
}) {
  return (
    <div className="hunts-chip-group">
      <span className="hunts-chip-group__label">{label}</span>
      <div className="hunts-chip-row">
        {ELEMENT_FILTERS.map((option) => (
          <Chip
            active={value === option}
            className="hunts-chip"
            key={option}
            onClick={() => onChange(option)}
          >
            {option === "Any" ? (
              "Todos"
            ) : (
              <>
                <ElementIcon element={option} size={14} />
                {elementLabel(option as CombatElement)}
              </>
            )}
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
  const [levelFilter, setLevelFilter] = useState<HuntLevelFilter>("Any");
  const [location, setLocation] = useState("Any");
  const [sortBy, setSortBy] = useState<HuntSort>("Best XP");
  const [attackElement, setAttackElement] = useState<ElementFilter>("Any");
  const [defenseElement, setDefenseElement] = useState<ElementFilter>("Any");
  const [queryDraft, setQueryDraft] = useState("");
  const [search, setSearch] = useState("");
  const [hunts, setHunts] = useState<HuntListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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
      setLoading(true);
      setError("");
      try {
        const result = await listHuntsPage({
          ...apiQuery,
          page: nextPage,
          limit: CATALOG_PAGE_SIZE,
        });
        if (!current()) return;
        const preferred = preferredHuntVocation(vocation, activeCharacter);
        const mapped = result.items.map((hunt) => mapHuntListItem(hunt, preferred));
        setHunts(mapped);
        setPage(result.page);
        setTotal(result.total);
        setError("");
      } catch (err) {
        if (!current()) return;
        setHunts([]);
        setTotal(0);
        setError(describeApiError(err));
      } finally {
        if (current()) {
          setLoading(false);
        }
      }
    },
    [activeCharacter, apiQuery, requests, vocation],
  );

  useEffect(() => {
    if (!isRosterReady) return;
    void loadHunts(1);
  }, [isRosterReady, loadHunts]);

  const locationOptions = useMemo(() => huntLocationOptions(hunts), [hunts]);

  const filtered = useMemo(
    () =>
      filterAndSortHunts(hunts, {
        query: "",
        vocation,
        attackElement,
        defenseElement,
        location,
        minXpH: "",
        minProfitH: "",
        minLevel: levelFilter === "Any" ? "" : levelFilter,
        sortBy,
        character: activeCharacter,
      }),
    [activeCharacter, attackElement, defenseElement, hunts, levelFilter, location, sortBy, vocation],
  );

  useEffect(() => {
    const term = search.trim();
    if (loading || term.length < 2 || filtered.length > 0) return;
    if (attackElement !== "Any" || defenseElement !== "Any") return;
    const timer = window.setTimeout(() => recordSearchMiss(term), 700);
    return () => window.clearTimeout(timer);
  }, [attackElement, defenseElement, filtered.length, loading, search]);

  const totalPages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));

  return (
    <div className="hunts-list">
      <PageContainer className="hunts-list__page" size="wide">
        <div className="hunts-head">
          <div className="hunts-head__title">
            <h1>
              <Icon name="swords" size={26} />
              Hunts
            </h1>
            <p className="hunts-list__subtitle">
              Encontre as melhores caçadas, compare XP, profit e progresso do bestiário.
            </p>
          </div>
          <SearchInput
            className="hunts-head__search"
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Buscar hunt, criatura ou local..."
            value={queryDraft}
          />
        </div>

        <CharacterSwitcher className="character-switcher--page" />

        <div className="hunts-filters">
          <div className="hunts-filter-row hunts-filter-row--main">
            <FilterSelect
              icon="shield"
              label="Vocação"
              onChange={(value: HuntVocationFilter) => {
                setVocationTouchedFor(characterKey);
                setVocationFilter(value);
              }}
              options={HUNT_VOCATION_FILTERS.map((value) => ({
                value,
                label: HUNT_VOCATION_LABEL[value] || value,
              }))}
              value={vocation}
            />
            <FilterSelect
              icon="swords"
              label="Dificuldade"
              onChange={setDifficulty}
              options={HUNT_DIFFICULTIES.map((value) => ({
                value,
                label: HUNT_DIFFICULTY_LABEL[value] || value.replace(/_/g, " "),
              }))}
              value={difficulty}
            />
            <FilterSelect
              icon="star"
              label="Nível"
              onChange={setLevelFilter}
              options={HUNT_LEVEL_FILTERS.map((value) => ({
                value,
                label: value === "Any" ? "Todos" : `${value}+`,
              }))}
              value={levelFilter}
            />
            <FilterSelect
              icon="map-pin"
              label="Localização"
              onChange={setLocation}
              options={[
                { value: "Any", label: "Todas" },
                ...locationOptions.map((value) => ({ value, label: value })),
              ]}
              value={location}
            />
            <FilterSelect
              icon="sort"
              label="Ordenar"
              onChange={setSortBy}
              options={HUNT_SORTS.map((value) => ({ value, label: HUNT_SORT_LABEL[value] }))}
              value={sortBy}
            />
          </div>
          <div className="hunts-filter-row hunts-filter-row--elements">
            <ElementChipRow label="Ataque" onChange={setAttackElement} value={attackElement} />
            <ElementChipRow label="Defesa da Hunt" onChange={setDefenseElement} value={defenseElement} />
          </div>
        </div>

        <div className="hunts-results-head">
          <strong>
            {loading
              ? "Carregando hunts"
              : `${filtered.length} hunts nesta página${total > filtered.length ? ` · ${total} no filtro` : ""}`}
          </strong>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando hunts" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void loadHunts(page)} />
        ) : (
          <>
            {filtered.length === 0 ? (
              <CatalogEmpty
                action={
                  <Button onClick={() => void loadHunts(1)} variant="secondary">
                    Recarregar
                  </Button>
                }
                description={
                  hunts.length === 0
                    ? "A API não retornou hunts para os filtros atuais."
                    : "Nenhuma hunt corresponde à busca ou aos filtros desta tela."
                }
                title="Nenhuma hunt encontrada"
              />
            ) : (
              <div className="hunts-grid">
                {filtered.map((hunt) => {
                  const summary = huntSummary(hunt);
                  const attacks = huntAttackElements(hunt);
                  const defenses = huntDefenseElements(hunt);
                  const bestiaryLines = formatHuntCardBestiaryLines(hunt.bestiarySummary);
                  const shown = hunt.spawn.slice(0, 3);
                  const extraCreatures = hunt.spawn.length - shown.length;
                  return (
                    <Link className="hunt-card" key={hunt.id || hunt.slug} to={`/hunts/${hunt.slug}`}>
                      <div
                        className="hunt-card__hero"
                        style={{
                          backgroundImage: `url("${hunt.heroImage || assetUrl("images/hunts/hunts_hero.webp")}")`,
                        }}
                      >
                        {hunt.creatureImage ? (
                          <img alt="" className="hunt-card__hero-creature" src={hunt.creatureImage} />
                        ) : null}
                        <div className="hunt-card__hero-top">
                          {summary.difficulty ? (
                            <span className={`hunt-card__tag ${difficultyToneClass(hunt.difficulty)}`.trim()}>
                              {summary.difficulty}
                            </span>
                          ) : null}
                          {summary.level ? (
                            <span className="hunt-card__tag hunt-card__tag--level">★ {summary.level}</span>
                          ) : null}
                        </div>
                        <div className="hunt-card__hero-title">
                          <h2>{hunt.name}</h2>
                          <p>
                            <Icon name="map-pin" size={12} />
                            {hunt.displayLocation || "Local não informado"}
                          </p>
                        </div>
                      </div>
                      <div className="hunt-card__body">
                        <div className="hunt-card__metrics">
                          <div>
                            <small>XP / hora</small>
                            <b className="hunt-card__metrics-xp">{summary.xp || "—"}</b>
                          </div>
                          <div>
                            <small>Profit / hora</small>
                            <b className="hunt-card__metrics-profit">{summary.profit || "—"}</b>
                          </div>
                        </div>
                        <div className="hunt-card__combat">
                          <div>
                            <small>Melhor ataque</small>
                            {attacks.length ? (
                              <span className="hunt-card__element-list">
                                {attacks.map((attack) => (
                                  <span className="hunts-element-pill" key={attack}>
                                    <ElementIcon element={attack} size={14} />
                                    {elementLabel(attack)}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="hunt-card__element-empty">Não informado</span>
                            )}
                          </div>
                          <div>
                            <small>Proteção</small>
                            {defenses.length ? (
                              <span className="hunt-card__element-list">
                                {defenses.map((defense) => (
                                  <span className="hunts-element-pill" key={defense}>
                                    <ElementIcon element={defense} size={14} />
                                    {elementLabel(defense)}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="hunt-card__element-empty">Não informado</span>
                            )}
                          </div>
                        </div>
                        {hunt.attention ? (
                          <div className="hunt-card__attention">
                            <Icon name="alert" size={14} />
                            <p>
                              <strong>Atenção</strong> {hunt.attention}
                            </p>
                          </div>
                        ) : null}
                        {bestiaryLines ? (
                          <div className="hunt-card__bestiary" aria-label="Resumo de bestiário">
                            <span>{bestiaryLines.bestiaryLine}</span>
                            <span>{bestiaryLines.charmLine}</span>
                          </div>
                        ) : null}
                        <div className="hunt-card__creatures">
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
                          {extraCreatures > 0 ? (
                            <span className="hunt-card__more">+{extraCreatures}</span>
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
            )}
            <Pagination onChange={(next) => void loadHunts(next)} page={page} totalPages={totalPages} />
          </>
        )}
      </PageContainer>
    </div>
  );
}
