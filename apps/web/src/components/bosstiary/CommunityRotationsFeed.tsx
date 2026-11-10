import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { CatalogImage } from "../catalog/CatalogImage";
import { Button } from "../ui/Button";
import { SearchInput, Select } from "../ui/FormControls";
import { Pagination } from "../ui/Pagination";
import {
  COMMUNITY_DURATION_FILTERS,
  COMMUNITY_LEVEL_FILTERS,
  COMMUNITY_MODE_FILTERS,
  COMMUNITY_SORT_OPTIONS,
  authorLabel,
  communityDurationLabel,
  communityHuntModeLabel,
  formatCommunityWhen,
  missionActivityPath,
} from "../../domain/bosstiary-community";
import {
  formatRewardAmount,
  isPlayableRewardMission,
  missionArtFile,
  progressPercent,
} from "../../domain/rewards";
import { useLatestRequest } from "../../hooks/useLatestRequest";
import { officialBossImage } from "../../domain/bosstiary-catalog";
import { resolveCreatureImage } from "../../domain/creature-image";
import { assetUrl } from "../../lib/assets";
import { describeApiError } from "../../services/api/errors";
import {
  createCommunityRotationTest,
  favoriteCommunityRotation,
  likeCommunityRotation,
  listCommunityRotationRanking,
  listCommunityRotations,
  unfavoriteCommunityRotation,
  unlikeCommunityRotation,
  type CommunityDurationFilter,
  type CommunityLevelFilter,
  type CommunityModeFilter,
  type CommunityRotationCard,
  type CommunityRotationRankingItem,
  type CommunityRotationSort,
} from "../../services/api/community-rotations";
import { getRewardsMe, listRewardMissions, type RewardMission } from "../../services/api/rewards";
import { CommunityRotationPublishModal } from "./CommunityRotationPublishModal";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_LIMIT = 12;

function art(file: string | null) {
  return file ? assetUrl(`images/rewards/${file}`) : "";
}

export function CommunityRotationsFeed() {
  const feedRequests = useLatestRequest();
  const sidebarRequests = useLatestRequest();
  const { isAuthenticated } = useAuth();
  const [level, setLevel] = useState<CommunityLevelFilter>("ALL");
  const [mode, setMode] = useState<CommunityModeFilter>("ALL");
  const [duration, setDuration] = useState<CommunityDurationFilter>("ALL");
  const [sort, setSort] = useState<CommunityRotationSort>("RECENT");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CommunityRotationCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socialBusy, setSocialBusy] = useState("");
  const [ranking, setRanking] = useState<CommunityRotationRankingItem[]>([]);
  const [rankingError, setRankingError] = useState("");
  const [missions, setMissions] = useState<RewardMission[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [level, mode, duration, sort, search]);

  const loadFeed = useCallback(async () => {
    const current = feedRequests.start();
    setLoading(true);
    setError("");
    try {
      const result = await listCommunityRotations({
        page,
        limit: PAGE_LIMIT,
        level,
        mode,
        duration,
        sort,
        search: search || undefined,
      });
      if (!current()) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      if (!current()) return;
      setItems([]);
      setTotal(0);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [duration, feedRequests, level, mode, page, search, sort]);

  const loadSidebar = useCallback(async () => {
    const current = sidebarRequests.start();
    setRankingError("");
    try {
      const [rank, missionList] = await Promise.all([
        listCommunityRotationRanking(5),
        listRewardMissions("WEEKLY"),
        getRewardsMe(),
      ]);
      if (!current()) return;
      setRanking(Array.isArray(rank) ? rank : []);
      setMissions(Array.isArray(missionList) ? missionList : []);
    } catch (err) {
      if (!current()) return;
      setRanking([]);
      setRankingError(describeApiError(err));
    }
  }, [sidebarRequests]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadSidebar();
  }, [loadSidebar]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const weeklyMission = useMemo(() => {
    const playable = missions.filter(isPlayableRewardMission);
    return (
      playable.find((mission) => mission.eventType === "BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED") ??
      playable.find((mission) => mission.eventType?.includes("BOSSTIARY")) ??
      null
    );
  }, [missions]);

  function applySocial(cardId: string, patch: Partial<CommunityRotationCard>) {
    setItems((current) => current.map((item) => (item.id === cardId ? { ...item, ...patch } : item)));
  }

  async function toggleLike(card: CommunityRotationCard) {
    if (!isAuthenticated || socialBusy) return;
    const key = `like:${card.id}`;
    setSocialBusy(key);
    try {
      const state = card.likedByMe
        ? await unlikeCommunityRotation(card.id)
        : await likeCommunityRotation(card.id);
      applySocial(card.id, {
        likedByMe: state.likedByMe,
        likesCount: state.likesCount,
      });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  async function toggleFavorite(card: CommunityRotationCard) {
    if (!isAuthenticated || socialBusy) return;
    const key = `fav:${card.id}`;
    setSocialBusy(key);
    try {
      const state = card.favoritedByMe
        ? await unfavoriteCommunityRotation(card.id)
        : await favoriteCommunityRotation(card.id);
      applySocial(card.id, {
        favoritedByMe: state.favoritedByMe,
        favoritesCount: state.favoritesCount,
      });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  async function markWorked(card: CommunityRotationCard) {
    if (!isAuthenticated || socialBusy || card.testedByMe) return;
    const key = `test:${card.id}`;
    setSocialBusy(key);
    try {
      await createCommunityRotationTest(card.id, {});
      applySocial(card.id, { testedByMe: true });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  const publishCta = (
    <Button className="bosstiary-community-cta" onClick={() => setPublishOpen(true)} type="button">
      Publicar rotação
    </Button>
  );

  return (
    <div className="bosstiary-community">
      <header className="bosstiary-community__header">
        <div>
          <span className="bosstiary-community__eyebrow">Bosstiário</span>
          <h2 className="bosstiary-community__title">Rotações da Comunidade</h2>
          <p className="bosstiary-community__lead">
            Rotas reais compartilhadas por jogadores premium — filtre por level, modo e duração.
          </p>
        </div>
        {publishCta}
      </header>

      <div className="bosstiary-community__layout">
        <main className="bosstiary-community__main">
          <section className="bosstiary-community-filters" aria-label="Filtros da comunidade">
            <div className="bosstiary-community-filters__row">
              <label className="field bosstiary-community-filters__search">
                <span className="sr-only">Buscar rotações</span>
                <SearchInput
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Buscar por título, descrição ou boss..."
                  value={searchDraft}
                />
              </label>
              <Select
                label="Level"
                onChange={(e) => setLevel(e.target.value as CommunityLevelFilter)}
                options={COMMUNITY_LEVEL_FILTERS.map((item) => ({ value: item.id, label: item.label }))}
                value={level}
              />
              <Select
                label="Modo"
                onChange={(e) => setMode(e.target.value as CommunityModeFilter)}
                options={COMMUNITY_MODE_FILTERS.map((item) => ({ value: item.id, label: item.label }))}
                value={mode}
              />
              <Select
                label="Duração"
                onChange={(e) => setDuration(e.target.value as CommunityDurationFilter)}
                options={COMMUNITY_DURATION_FILTERS.map((item) => ({ value: item.id, label: item.label }))}
                value={duration}
              />
              <Select
                label="Ordenar"
                onChange={(e) => setSort(e.target.value as CommunityRotationSort)}
                options={COMMUNITY_SORT_OPTIONS.map((item) => ({ value: item.id, label: item.label }))}
                value={sort}
              />
            </div>
          </section>

          {error ? <CatalogError description={error} onRetry={() => void loadFeed()} /> : null}

          {loading && items.length === 0 ? <CatalogLoading label="Carregando rotações da comunidade" /> : null}

          {!loading && !error && items.length === 0 ? (
            <CatalogEmpty
              description="Ainda não há rotações publicadas com estes filtros. Seja o primeiro a compartilhar a sua."
              title="Nenhuma rotação encontrada"
            />
          ) : null}

          {items.length ? (
            <>
              <ul className="bosstiary-community-grid">
                {items.map((card) => (
                  <li key={card.id}>
                    <article
                      className={`bosstiary-community-card${card.featured ? " bosstiary-community-card--featured" : ""}`}
                    >
                      {card.featured ? <span className="bosstiary-community-card__badge">Destaque semanal</span> : null}
                      <header className="bosstiary-community-card__author">
                        <span aria-hidden="true" className="bosstiary-community-card__avatar">
                          {authorLabel(card.author.name).slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{authorLabel(card.author.name)}</strong>
                          <p className="bosstiary-community-card__meta">
                            {[card.author.level, card.author.vocation, communityHuntModeLabel(card.huntMode)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <time className="bosstiary-community-card__when" dateTime={card.createdAt}>
                          {formatCommunityWhen(card.createdAt)}
                        </time>
                      </header>
                      <Link className="bosstiary-community-card__title" to={`/bosstiary/community/${card.id}`}>
                        {card.title}
                      </Link>
                      <ol className="bosstiary-community-card__sequence" aria-label="Bosses na rotação">
                        {[...card.bosses]
                          .sort((left, right) => left.position - right.position)
                          .map((stop, index, stops) => {
                            const name = stop.name || stop.bossName || "Boss";
                            const src =
                              officialBossImage(name, stop.slug) ??
                              resolveCreatureImage(stop.image, stop.slug, name);
                            return (
                              <li key={stop.id}>
                                <span className="bosstiary-community-card__sequence-stop">
                                  <span className="bosstiary-community-card__sequence-order">{stop.position}.</span>
                                  <CatalogImage
                                    alt=""
                                    className="bosstiary-community-card__boss-img"
                                    name={name}
                                    src={src}
                                  />
                                  <span className="bosstiary-community-card__sequence-name">{name}</span>
                                </span>
                                {index < stops.length - 1 ? (
                                  <span aria-hidden="true" className="bosstiary-community-card__sequence-arrow">
                                    →
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                      </ol>
                      <dl className="bosstiary-community-card__stats">
                        <div>
                          <dt>Level</dt>
                          <dd>{card.recommendedLevelLabel}</dd>
                        </div>
                        <div>
                          <dt>Modo</dt>
                          <dd>{communityHuntModeLabel(card.huntMode)}</dd>
                        </div>
                        <div>
                          <dt>Duração</dt>
                          <dd>{communityDurationLabel(card.plannedDurationMinutes)}</dd>
                        </div>
                      </dl>
                      {card.testedByAuthor ? (
                        <p className="bosstiary-community-card__tested">Testada pelo autor</p>
                      ) : null}
                      <footer className="bosstiary-community-card__foot bosstiary-community-card__actions">
                        <Button
                          aria-pressed={card.likedByMe}
                          disabled={!isAuthenticated || socialBusy === `like:${card.id}`}
                          loading={socialBusy === `like:${card.id}`}
                          onClick={() => void toggleLike(card)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {card.likedByMe ? "Curtido" : "Curtir"} · {card.likesCount}
                        </Button>
                        <Link className="bosstiary-community-card__comments" to={`/bosstiary/community/${card.id}`}>
                          Comentários · {card.commentsCount}
                        </Link>
                        <Button
                          aria-pressed={card.favoritedByMe}
                          disabled={!isAuthenticated || socialBusy === `fav:${card.id}`}
                          loading={socialBusy === `fav:${card.id}`}
                          onClick={() => void toggleFavorite(card)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {card.favoritedByMe ? "Favoritada" : "Favoritar"}
                        </Button>
                        <Button
                          aria-pressed={card.testedByMe}
                          disabled={!isAuthenticated || card.testedByMe || socialBusy === `test:${card.id}`}
                          loading={socialBusy === `test:${card.id}`}
                          onClick={() => void markWorked(card)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Funcionou pra mim
                        </Button>
                      </footer>
                    </article>
                  </li>
                ))}
              </ul>
              <Pagination
                disabled={loading}
                onChange={(next) => setPage(next)}
                page={page}
                totalPages={totalPages}
              />
            </>
          ) : null}
        </main>

        <aside className="bosstiary-community__sidebar" aria-label="Painel lateral">
          <section className="bosstiary-community-panel bosstiary-community-rewards">
            <header>
              <h3>Recompensas semanais</h3>
              <p>Publique uma rotação e avance na missão do Bosstiário.</p>
            </header>
            {weeklyMission ? (
              <article className="rewards-mission bosstiary-community-rewards__mission">
                {(() => {
                  const file = missionArtFile(weeklyMission);
                  return file ? <img alt="" src={art(file)} /> : <span className="rewards-mission__fallback" />;
                })()}
                <span className="rewards-mission__shade" />
                <span className="rewards-mission__body">
                  <span className="rewards-mission__title">{weeklyMission.title}</span>
                  <span className="rewards-mission__desc">{weeklyMission.description}</span>
                  <span className="rewards-progress">
                    <i>
                      <i style={{ width: `${progressPercent(weeklyMission.current, weeklyMission.target)}%` }} />
                    </i>
                    <b>
                      {weeklyMission.current} / {weeklyMission.target}
                    </b>
                  </span>
                  <span className="rewards-mission__action">
                    +{formatRewardAmount(weeklyMission.rewardPoints)} pontos
                  </span>
                  {missionActivityPath(weeklyMission.eventType) ? (
                    <Link className="bosstiary-community-rewards__link" to={missionActivityPath(weeklyMission.eventType)!}>
                      Ver missão
                    </Link>
                  ) : null}
                </span>
              </article>
            ) : (
              <p className="bosstiary-community-panel__empty">Nenhuma missão semanal publicada para rotações ainda.</p>
            )}
            {publishCta}
          </section>

          <section className="bosstiary-community-panel bosstiary-community-ranking">
            <header>
              <h3>Ranking semanal</h3>
              <p>Mais curtidas nesta semana.</p>
            </header>
            {rankingError ? <p className="bosstiary-community-panel__error">{rankingError}</p> : null}
            {ranking.length === 0 && !rankingError ? (
              <p className="bosstiary-community-panel__empty">Sem curtidas nesta semana ainda.</p>
            ) : (
              <ol className="bosstiary-community-ranking__list">
                {ranking.map((item, index) => (
                  <li key={item.id}>
                    <span className="bosstiary-community-ranking__pos">{index + 1}</span>
                    <div>
                      <Link to={`/bosstiary/community/${item.id}`}>{item.title}</Link>
                      <small>
                        {item.weeklyLikes} curtidas · {authorLabel(item.author.name)}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <CommunityRotationPublishModal
        onClose={() => setPublishOpen(false)}
        onPublished={() => {
          void loadFeed();
          void loadSidebar();
        }}
        open={publishOpen}
      />
    </div>
  );
}
