import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CharacterSwitcher } from "../components/characters/CharacterSwitcher";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { ButtonLink } from "../components/ui/Button";
import { ElementIcon } from "../components/ui/ElementIcon";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { formatCharmLabel, formatCount } from "../domain/format";
import { elementLabel } from "../domain/elements";
import {
  huntAttackElements,
  huntDefenseElements,
  huntSummary,
  mapHuntDetail,
  preferredHuntVocation,
} from "../domain/hunts";
import {
  formatBestiaryDifficultyLabel,
  formatHuntCardBestiarySummary,
} from "../domain/hunt-bestiary";
import { youtubeThumbnailUrl } from "../domain/youtube";
import { HuntVocationBreakdown } from "../components/hunts/HuntVocationBreakdown";
import { HuntComments } from "../components/hunts/HuntComments";
import { HuntUpdateRequests } from "../components/hunts/HuntUpdateRequests";
import { ReportProblem } from "../components/tickets/ReportProblem";
import { describeApiError } from "../services/api/errors";
import { recordContentView } from "../services/api/admin-portal";
import { getHuntBySlug } from "../services/api/hunts";

export function HuntDetailPage() {
  const { slug = "" } = useParams();
  const { activeCharacter } = useAuth();
  const requests = useLatestRequest();
  const [rawHunt, setRawHunt] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const preferred = preferredHuntVocation("Any", activeCharacter);

  const loadHunt = useCallback(async () => {
    const current = requests.start();
    if (!slug) {
      setRawHunt(null);
      setError("Hunt não encontrada.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getHuntBySlug(slug);
      if (!current()) return;
      setRawHunt(data);
    } catch (err) {
      if (!current()) return;
      setRawHunt(null);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [requests, slug]);

  useEffect(() => {
    void loadHunt();
  }, [loadHunt]);

  const hunt = useMemo(
    () =>
      rawHunt
        ? mapHuntDetail(rawHunt, preferred, activeCharacter?.level ?? null)
        : null,
    [activeCharacter?.level, preferred, rawHunt],
  );

  useEffect(() => {
    if (hunt?.id && /^[0-9a-f-]{36}$/i.test(hunt.id)) {
      recordContentView("HUNT", hunt.id);
    }
  }, [hunt?.id]);

  const summary = hunt ? huntSummary(hunt) : null;
  const spawn = useMemo(() => hunt?.spawn || [], [hunt]);
  const loot = hunt?.loot || [];
  const videos = hunt?.videos || [];
  const primaryVideo = useMemo(
    () => videos.find((video) => video.isRecommended) || videos[0] || null,
    [videos],
  );
  const attacks = hunt ? huntAttackElements(hunt) : [];
  const defenses = hunt ? huntDefenseElements(hunt) : [];
  const bestiarySummary = hunt ? formatHuntCardBestiarySummary(hunt.bestiarySummary) : null;

  async function shareHunt() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: hunt?.name || "RuneCodex", url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled share */
    }
  }

  if (loading) {
    return (
      <div className="hunt-detail">
        <div className="hunt-detail__content">
          <CatalogLoading label="Carregando hunt" />
        </div>
      </div>
    );
  }

  if (!hunt) {
    return (
      <div className="hunt-detail">
        <div className="hunt-detail__content">
          <CatalogError
            description={error || "Esta hunt não foi encontrada."}
            onRetry={() => void loadHunt()}
            title="Hunt indisponível"
          />
          <ButtonLink to="/hunts" variant="ghost">
            Voltar às hunts
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="hunt-detail">
      <div className="hunt-detail__content">
        <div className="hunt-detail__topbar">
          <Link aria-label="Voltar às hunts" className="hunt-detail__icon-btn" to="/hunts">
            ‹
          </Link>
          <div className="hunt-detail__actions">
            <button
              aria-label="Compartilhar hunt"
              className="hunt-detail__icon-btn hunt-detail__icon-btn--square"
              onClick={() => void shareHunt()}
              type="button"
            >
              ↗
            </button>
            {hunt.youtubeUrl ? (
              <a
                aria-label="Abrir YouTube"
                className="hunt-detail__icon-btn hunt-detail__icon-btn--square hunt-detail__icon-btn--youtube"
                href={hunt.youtubeUrl}
                rel="noreferrer"
                target="_blank"
              >
                ▶
              </a>
            ) : null}
          </div>
        </div>

        <header className="hunt-detail__header">
          <span className="eyebrow">RuneCodex • Detalhes da Hunt</span>
          <h1>{hunt.name}</h1>
          {hunt.displayLocation ? <p className="hunt-detail__location">{hunt.displayLocation}</p> : null}
          <CharacterSwitcher className="character-switcher--page" id="hunt-detail-character" />
          <div className="hunt-detail__chips">
            {summary?.difficulty ? <span className="hunt-detail__chip">{summary.difficulty}</span> : null}
            {summary?.level ? <span className="hunt-detail__chip">Level {summary.level}</span> : null}
          </div>
        </header>

        <div className="hunt-detail__layout">
          <div className="hunt-detail__main">
            <div className="hunt-detail__kpis">
              <div className="hunt-detail__kpi">
                <span className="hunt-detail__kpi-icon hunt-detail__kpi-icon--xp">XP</span>
                <div>
                  <small>XP/h</small>
                  <strong>{summary?.xp || "—"}</strong>
                </div>
              </div>
              <div className="hunt-detail__kpi">
                <span className="hunt-detail__kpi-icon">◉</span>
                <div>
                  <small>Profit/h</small>
                  <strong>{summary?.profit || "—"}</strong>
                </div>
              </div>
              <div className="hunt-detail__kpi">
                <span className="hunt-detail__kpi-icon">♟</span>
                <div>
                  <small>Criaturas</small>
                  <strong>{spawn.length || "—"}</strong>
                </div>
              </div>
            </div>

            {hunt.vocations.length ? (
              <section>
                <h2 className="hunt-detail__section-title">
                  <span>♦</span> Level e vocações recomendadas
                </h2>
                <HuntVocationBreakdown vocations={hunt.vocations} />
              </section>
            ) : null}

            {hunt.attention || hunt.description ? (
              <section className="hunt-detail__intro-copy">
                {hunt.attention ? (
                  <aside className="hunt-detail__attention" role="note">
                    <span aria-hidden="true" className="hunt-detail__attention-icon">
                      ⚠
                    </span>
                    <div>
                      <strong className="hunt-detail__attention-title">Dica de hunt</strong>
                      <p className="hunt-detail__attention-text">{hunt.attention}</p>
                    </div>
                  </aside>
                ) : null}
                {hunt.description ? <p className="hunt-detail__copy">{hunt.description}</p> : null}
              </section>
            ) : null}

            {hunt.mapImage || primaryVideo ? (
              <section className="hunt-detail__media">
                {hunt.mapImage ? (
                  <article className="hunt-detail__media-card">
                    <img alt={`Mapa de ${hunt.name}`} className="hunt-detail__media-thumb" src={hunt.mapImage} />
                    <div className="hunt-detail__media-body">
                      <h3>Mapa da Hunt</h3>
                      <button
                        className="hunt-detail__media-action"
                        onClick={() => setMapOpen(true)}
                        type="button"
                      >
                        Abrir mapa <Icon name="chevron-right" size={14} />
                      </button>
                    </div>
                  </article>
                ) : null}
                {primaryVideo ? (
                  <article className="hunt-detail__media-card">
                    <CatalogImage
                      alt=""
                      className="hunt-detail__media-thumb"
                      name={hunt.name}
                      src={youtubeThumbnailUrl(primaryVideo.url)}
                    />
                    <div className="hunt-detail__media-body">
                      <h3>{primaryVideo.title || "Vídeo da Hunt"}</h3>
                      {primaryVideo.channel ? <p className="hunt-detail__media-channel">{primaryVideo.channel}</p> : null}
                      <a
                        className="hunt-detail__media-action"
                        href={primaryVideo.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver no YouTube <Icon name="chevron-right" size={14} />
                      </a>
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}

            {spawn.length ? (
              <section>
                <h2 className="hunt-detail__section-title">
                  <span>⚔</span> Criaturas / Charms
                </h2>
                <div className="hunt-detail__creatures">
                  {spawn.map((creature) => (
                    <article className="hunt-creature" key={`${creature.slug || creature.name}`}>
                      {creature.image ? (
                        <img alt={creature.name} className="hunt-creature__art" src={creature.image} />
                      ) : null}
                      <div>
                        {creature.slug ? (
                          <Link className="hunt-creature__name" to={`/bestiary/${creature.slug}`}>
                            {creature.name}
                          </Link>
                        ) : (
                          <div className="hunt-creature__name">{creature.name}</div>
                        )}
                        {creature.notes ? <p className="hunt-creature__notes">{creature.notes}</p> : null}
                        <div className="hunt-creature__meta">
                          {formatCount(creature.hp) ? <span>{formatCount(creature.hp)} HP</span> : null}
                          {formatCount(creature.xp) ? <span>{formatCount(creature.xp)} XP</span> : null}
                        </div>
                        {creature.bestiary.hasEntry ? (
                          <dl className="hunt-creature__bestiary">
                            <div>
                              <dt>Dificuldade</dt>
                              <dd>
                                {formatBestiaryDifficultyLabel(
                                  creature.bestiary,
                                  creature.catalogDifficulty,
                                ) || "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Kills necessárias</dt>
                              <dd>{formatCount(creature.bestiary.killsRequired) || "—"}</dd>
                            </div>
                            <div>
                              <dt>Charm points</dt>
                              <dd>{formatCount(creature.bestiary.charmPoints) || "—"}</dd>
                            </div>
                          </dl>
                        ) : (
                          <p className="hunt-creature__bestiary-missing">Bestiário não cadastrado</p>
                        )}
                        {creature.recommendedCharm ? (
                          <div className="hunt-creature__charm">
                            <ElementIcon element={creature.recommendedCharm} size={28} />
                            <span>
                              <small>Charm</small>
                              {formatCharmLabel(creature.recommendedCharm)}
                            </span>
                          </div>
                        ) : null}
                        {creature.elements.length ? (
                          <div className="hunt-creature__elements">
                            {creature.elements.map((element) => (
                              <span key={element}>
                                <ElementIcon element={element} size={16} />
                                {formatCharmLabel(element)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="hunt-detail__section-title">
                <span>▤</span> Informações da Hunt
              </h2>
              <div className="hunt-info">
                {hunt.respawn ? (
                  <div className="hunt-info__row">
                    <span>Respawn</span>
                    <strong>{hunt.respawn}</strong>
                  </div>
                ) : null}
                {bestiarySummary ? (
                  <div className="hunt-info__row">
                    <span>Bestiário (hunt)</span>
                    <strong>
                      {[`${bestiarySummary.charms} charm points`, bestiarySummary.creatures].join(" · ")}
                    </strong>
                  </div>
                ) : null}
                {attacks.length ? (
                  <div className="hunt-info__row">
                    <span>Melhor ataque</span>
                    <strong>
                      {attacks.map(elementLabel).join(" + ")}
                      {hunt.bestAttack?.status === "PARTIAL"
                        ? ` · Dados parciais (${hunt.bestAttack.creaturesWithAnyData}/${hunt.bestAttack.creatureCount} criaturas com dados)`
                        : ""}
                    </strong>
                  </div>
                ) : null}
                {defenses.length ? (
                  <div className="hunt-info__row">
                    <span>Proteção</span>
                    <strong>{defenses.map(elementLabel).join(" · ")}</strong>
                  </div>
                ) : null}
              </div>
            </section>

            {loot.length ? (
              <details className="hunt-accordion" open>
                <summary>Loot principal</summary>
                <ul>
                  {loot.map((item) => (
                    <li key={item.id}>
                      <strong>{item.itemName}</strong>
                      <span>
                        {item.importance ? formatCharmLabel(item.importance) : ""}
                        {formatCount(item.estimatedValue) ? ` · ${formatCount(item.estimatedValue)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {videos.length ? (
              <details className="hunt-accordion">
                <summary>Vídeos recomendados</summary>
                <ul>
                  {videos.map((video) => (
                    <li key={video.id}>
                      <a href={video.url} rel="noreferrer" target="_blank">
                        {video.title || "YouTube"}
                      </a>
                      {video.channel ? <span>{video.channel}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <aside className="hunt-detail__sidebar">
            <div className="hunt-detail__comments-panel">
              <HuntComments slug={hunt.slug} />
            </div>
            <details className="hunt-detail__side-accordion">
              <summary>Solicitações e report</summary>
              <div className="hunt-detail__side-accordion-body">
                <HuntUpdateRequests
                  characterLevel={activeCharacter?.level ?? null}
                  slug={hunt.slug}
                  vocations={hunt.vocations}
                />
                <ReportProblem huntId={hunt.id} origin="HUNT" />
              </div>
            </details>
          </aside>
        </div>
      </div>

      <Modal onClose={() => setMapOpen(false)} open={mapOpen} title="Mapa da hunt">
        {hunt.mapImage ? <img alt={`Mapa de ${hunt.name}`} className="map-image" src={hunt.mapImage} /> : null}
      </Modal>
    </div>
  );
}
