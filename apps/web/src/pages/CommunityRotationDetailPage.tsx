import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CommunityRotationComments } from "../components/bosstiary/CommunityRotationComments";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import {
  authorLabel,
  communityDurationLabel,
  communityHuntModeLabel,
  formatCommunityWhen,
} from "../domain/bosstiary-community";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { describeApiError } from "../services/api/errors";
import {
  createCommunityRotationTest,
  favoriteCommunityRotation,
  getCommunityRotation,
  likeCommunityRotation,
  unfavoriteCommunityRotation,
  unlikeCommunityRotation,
  type CommunityRotationCard,
} from "../services/api/community-rotations";

export function CommunityRotationDetailPage() {
  const { id = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const requests = useLatestRequest();
  const [rotation, setRotation] = useState<CommunityRotationCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socialBusy, setSocialBusy] = useState("");
  const [shareHint, setShareHint] = useState("");

  const load = useCallback(async () => {
    const current = requests.start();
    if (!id) {
      setRotation(null);
      setError("Rotação não encontrada.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getCommunityRotation(id);
      if (!current()) return;
      setRotation(data);
    } catch (err) {
      if (!current()) return;
      setRotation(null);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [id, requests]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!rotation || !isAuthenticated || socialBusy) return;
    setSocialBusy("like");
    try {
      const state = rotation.likedByMe
        ? await unlikeCommunityRotation(rotation.id)
        : await likeCommunityRotation(rotation.id);
      setRotation((current) =>
        current
          ? {
              ...current,
              likedByMe: state.likedByMe,
              likesCount: state.likesCount,
            }
          : current,
      );
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  async function markWorked() {
    if (!rotation || !isAuthenticated || socialBusy || rotation.testedByMe) return;
    setSocialBusy("test");
    try {
      await createCommunityRotationTest(rotation.id, {});
      setRotation((current) => (current ? { ...current, testedByMe: true } : current));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  async function shareRotation() {
    if (!rotation) return;
    const url = `${window.location.origin}/bosstiary/community/${rotation.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: rotation.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareHint("Link copiado.");
    } catch {
      setShareHint("");
    }
  }

  async function toggleFavorite() {
    if (!rotation || !isAuthenticated || socialBusy) return;
    setSocialBusy("favorite");
    try {
      const state = rotation.favoritedByMe
        ? await unfavoriteCommunityRotation(rotation.id)
        : await favoriteCommunityRotation(rotation.id);
      setRotation((current) =>
        current
          ? {
              ...current,
              favoritedByMe: state.favoritedByMe,
              favoritesCount: state.favoritesCount,
            }
          : current,
      );
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSocialBusy("");
    }
  }

  return (
    <PageContainer className="bosstiary-community-detail" size="wide">
      <nav className="bosstiary-community-detail__crumb" aria-label="Voltar">
        <Link to="/bosstiary">← Bosstiário · Comunidade</Link>
      </nav>

      {loading ? <CatalogLoading label="Carregando rotação" /> : null}
      {error && !loading ? <CatalogError description={error} onRetry={() => void load()} /> : null}

      {rotation ? (
        <>
          <header className="bosstiary-community-detail__head">
            <div>
              {rotation.featured ? <span className="bosstiary-community-card__badge">Destaque semanal</span> : null}
              <h1>{rotation.title}</h1>
              <p className="bosstiary-community-detail__meta">
                {authorLabel(rotation.author.name)} · Publicado {formatCommunityWhen(rotation.createdAt)}
              </p>
            </div>
            <div className="bosstiary-community-detail__actions">
              <Button
                aria-pressed={rotation.likedByMe}
                disabled={!isAuthenticated || socialBusy === "like"}
                loading={socialBusy === "like"}
                onClick={() => void toggleLike()}
                type="button"
                variant="secondary"
              >
                {rotation.likedByMe ? "Curtido" : "Curtir"} · {rotation.likesCount}
              </Button>
              <Button
                aria-pressed={rotation.favoritedByMe}
                disabled={!isAuthenticated || socialBusy === "favorite"}
                loading={socialBusy === "favorite"}
                onClick={() => void toggleFavorite()}
                type="button"
                variant="ghost"
              >
                {rotation.favoritedByMe ? "Favoritada" : "Favoritar"} · {rotation.favoritesCount}
              </Button>
              <Button
                aria-pressed={rotation.testedByMe}
                disabled={!isAuthenticated || rotation.testedByMe || socialBusy === "test"}
                loading={socialBusy === "test"}
                onClick={() => void markWorked()}
                type="button"
                variant="ghost"
              >
                Funcionou pra mim
              </Button>
              <Button onClick={() => void shareRotation()} type="button" variant="ghost">
                {shareHint || "Compartilhar"}
              </Button>
            </div>
          </header>

          <dl className="bosstiary-community-detail__stats">
            <div>
              <dt>Level recomendado</dt>
              <dd>{rotation.recommendedLevelLabel}</dd>
            </div>
            <div>
              <dt>Modo</dt>
              <dd>{communityHuntModeLabel(rotation.huntMode)}</dd>
            </div>
            <div>
              <dt>Duração planejada</dt>
              <dd>{communityDurationLabel(rotation.plannedDurationMinutes)}</dd>
            </div>
            {rotation.vocation ? (
              <div>
                <dt>Vocação (autor)</dt>
                <dd>{rotation.vocation}</dd>
              </div>
            ) : null}
            {rotation.characterLevel ? (
              <div>
                <dt>Level (autor)</dt>
                <dd>{rotation.characterLevel}</dd>
              </div>
            ) : null}
            {rotation.testedByAuthor ? (
              <div>
                <dt>Validação</dt>
                <dd>Testada pelo autor</dd>
              </div>
            ) : null}
          </dl>

          {rotation.description ? (
            <section className="bosstiary-community-detail__section">
              <h2>Descrição</h2>
              <p>{rotation.description}</p>
            </section>
          ) : null}

          {rotation.accessRequirements ? (
            <section className="bosstiary-community-detail__section">
              <h2>Requisitos de acesso</h2>
              <p>{rotation.accessRequirements}</p>
            </section>
          ) : null}

          {rotation.additionalInfo ? (
            <section className="bosstiary-community-detail__section">
              <h2>Informações adicionais</h2>
              <p>{rotation.additionalInfo}</p>
            </section>
          ) : null}

          <section className="bosstiary-community-detail__section">
            <h2>Ordem dos bosses</h2>
            <ol className="bosstiary-community-detail__stops">
              {rotation.bosses
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((stop) => (
                  <li key={stop.id}>
                    <CatalogImage alt="" name={stop.name ?? stop.bossName ?? ""} src={stop.image} />
                    <div>
                      <strong>
                        {stop.position}. {stop.name || stop.bossName}
                      </strong>
                      {stop.notes ? <p>{stop.notes}</p> : null}
                      {stop.slug ? (
                        <Link to={`/bosstiary/${stop.slug}`}>Ver perfil revisado</Link>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ol>
          </section>

          <CommunityRotationComments rotationId={rotation.id} />
        </>
      ) : null}
    </PageContainer>
  );
}
