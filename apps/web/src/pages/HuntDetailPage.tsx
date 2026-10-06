import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { ButtonLink } from "../components/ui/Button";
import { ElementIcon } from "../components/ui/ElementIcon";
import { Modal } from "../components/ui/Modal";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { formatCharmLabel, formatCount, formatLevelRange, formatRate } from "../domain/format";
import { elementLabel } from "../domain/elements";
import {
  huntAttackElements,
  huntDefenseElements,
  huntSummary,
  mapHuntDetail,
  preferredHuntVocation,
} from "../domain/hunts";
import { HuntComments } from "../components/hunts/HuntComments";
import { describeApiError } from "../services/api/errors";
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
    () => (rawHunt ? mapHuntDetail(rawHunt, preferred) : null),
    [preferred, rawHunt],
  );

  const summary = hunt ? huntSummary(hunt) : null;
  const spawn = useMemo(() => hunt?.spawn || [], [hunt]);
  const loot = hunt?.loot || [];
  const vocations = hunt?.vocations || [];
  const videos = hunt?.videos || [];
  const attacks = hunt ? huntAttackElements(hunt) : [];
  const defenses = hunt ? huntDefenseElements(hunt) : [];

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
          <div className="hunt-detail__chips">
            {summary?.difficulty ? <span className="hunt-detail__chip">{summary.difficulty}</span> : null}
            {summary?.level ? <span className="hunt-detail__chip">Level {summary.level}</span> : null}
            {hunt.vocation ? <span className="hunt-detail__chip">{hunt.vocation}</span> : null}
            {attacks.map((element) => (
              <span className="hunt-detail__chip" key={`atk-${element}`}>
                <ElementIcon element={element} /> {elementLabel(element)}
              </span>
            ))}
          </div>
        </header>

        <div className="hunt-detail__cta">
          {hunt.mapImage ? (
            <button className="hunt-detail__action hunt-detail__action--map" onClick={() => setMapOpen(true)} type="button">
              Ver mapa
            </button>
          ) : null}
          {hunt.youtubeUrl ? (
            <a className="hunt-detail__action hunt-detail__action--youtube" href={hunt.youtubeUrl} rel="noreferrer" target="_blank">
              YouTube
            </a>
          ) : null}
        </div>

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
            {summary?.level ? (
              <div className="hunt-info__row">
                <span>Nível recomendado</span>
                <strong>{summary.level}</strong>
              </div>
            ) : null}
            {hunt.displayLocation ? (
              <div className="hunt-info__row">
                <span>Localização</span>
                <strong>{hunt.displayLocation}</strong>
              </div>
            ) : null}
            {hunt.respawn ? (
              <div className="hunt-info__row">
                <span>Respawn</span>
                <strong>{hunt.respawn}</strong>
              </div>
            ) : null}
            {attacks.length ? (
              <div className="hunt-info__row">
                <span>Melhor ataque</span>
                <strong>{attacks.map(elementLabel).join(" · ")}</strong>
              </div>
            ) : null}
            {defenses.length ? (
              <div className="hunt-info__row">
                <span>Atenção / dano recebido</span>
                <strong>{defenses.map(elementLabel).join(" · ")}</strong>
              </div>
            ) : null}
            {summary?.difficulty ? (
              <div className="hunt-info__row">
                <span>Dificuldade</span>
                <strong>{summary.difficulty}</strong>
              </div>
            ) : null}
            {vocations.length ? (
              <div className="hunt-info__row">
                <span>Vocações</span>
                <strong>
                  {vocations
                    .map((entry) =>
                      [
                        entry.vocation,
                        entry.isRecommended ? "recomendada" : "",
                        formatLevelRange(entry.levelMin, entry.levelMax),
                        formatRate(entry.xpPerHour) ? `${formatRate(entry.xpPerHour)} XP/h` : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(" | ")}
                </strong>
              </div>
            ) : null}
          </div>
          {hunt.description ? <p className="hunt-detail__copy">{hunt.description}</p> : null}
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
          <details className="hunt-accordion" open>
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

        <HuntComments slug={hunt.slug} />
      </div>

      <Modal onClose={() => setMapOpen(false)} open={mapOpen} title="Mapa da hunt">
        {hunt.mapImage ? <img alt={`Mapa de ${hunt.name}`} className="map-image" src={hunt.mapImage} /> : null}
      </Modal>
    </div>
  );
}
