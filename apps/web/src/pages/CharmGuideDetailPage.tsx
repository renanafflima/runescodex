import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import {
  CHARM_GUIDE_DIFFICULTY_LABEL,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
} from "../domain/charm-guides";
import { resolveCreatureImage } from "../domain/creature-image";
import { describeApiError } from "../services/api/errors";
import {
  createCharmGuideComment,
  favoriteCharmGuide,
  getCharmGuide,
  likeCharmGuide,
  listCharmGuideComments,
  unfavoriteCharmGuide,
  unlikeCharmGuide,
  updateCharmGuideProgress,
  type CharmGuideDetail,
} from "../services/api/charm-guides";

export function CharmGuideDetailPage() {
  const { id = "" } = useParams();
  const { activeCharacter, isAuthenticated } = useAuth();
  const [guide, setGuide] = useState<CharmGuideDetail | null>(null);
  const [comments, setComments] = useState<Array<{ id: string; content: string; author: { name: string } }>>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const detail = await getCharmGuide(id, activeCharacter?.id);
      setGuide(detail);
      if (detail.status !== "PUBLISHED") {
        setComments([]);
        return;
      }
      try {
        const commentPage = await listCharmGuideComments(id);
        setComments(commentPage.items as Array<{ id: string; content: string; author: { name: string } }>);
      } catch (commentErr) {
        if (import.meta.env.DEV) {
          console.error("[charm-guide-detail] comments", commentErr);
        }
        setComments([]);
      }
    } catch (err) {
      setGuide(null);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, [activeCharacter?.id, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!guide) return;
    if (guide.likedByMe) await unlikeCharmGuide(guide.id);
    else await likeCharmGuide(guide.id);
    await load();
  }

  async function toggleFavorite() {
    if (!guide) return;
    if (guide.favoritedByMe) await unfavoriteCharmGuide(guide.id);
    else await favoriteCharmGuide(guide.id);
    await load();
  }

  async function toggleCreature(creatureId: string, completed: boolean) {
    if (!guide || !activeCharacter) {
      setNotice("Selecione um personagem ativo para registrar progresso.");
      return;
    }
    await updateCharmGuideProgress(guide.id, {
      characterId: activeCharacter.id,
      creatureId,
      completed: !completed,
    });
    await load();
  }

  async function sendComment() {
    if (!guide || comment.trim().length < 1) return;
    await createCharmGuideComment(guide.id, { content: comment.trim() });
    setComment("");
    await load();
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: guide?.title, url });
      else await navigator.clipboard.writeText(url);
      setNotice("Link copiado.");
    } catch {
      /* cancelled */
    }
  }

  if (loading) {
    return (
      <PageContainer size="wide">
        <CatalogLoading label="Carregando guia" />
      </PageContainer>
    );
  }

  if (!guide) {
    return (
      <PageContainer size="wide">
        <CatalogError description={error || "Guia não encontrado."} onRetry={() => void load()} />
        <ButtonLinkBack />
      </PageContainer>
    );
  }

  return (
    <div className="charm-guide-detail">
      <PageContainer size="wide">
        <ButtonLinkBack />
        <header className="charm-guide-detail__header">
          <div className="section-kicker">Guia de Charm Points</div>
          <h1>{guide.title}</h1>
          <p>
            {charmGuideCategoryPoints(guide.cpCategory)} CP ·{" "}
            {charmGuideCategoryLabel(guide.cpCategory)} ·{" "}
            {CHARM_GUIDE_DIFFICULTY_LABEL[guide.difficulty]} · por {guide.author.name}
          </p>
          <p>{guide.description}</p>
          {guide.status === "PENDING_REVIEW" ? (
            <p role="status">Este guia está em análise e ainda não aparece na comunidade.</p>
          ) : null}
          {guide.status === "CHANGES_REQUESTED" || guide.status === "REJECTED" ? (
            <p role="status">
              {guide.adminResponse || "A equipe pediu ajustes neste guia antes da publicação."}
            </p>
          ) : null}
          <div className="post-tags">
            <span>{guide.totalCharmPoints} CP únicos</span>
            <span>{guide.stepCount} etapas</span>
            <span>{guide.uniqueCreatureCount} criaturas</span>
          </div>
          {guide.status === "PUBLISHED" ? (
            <div className="post-actions">
              <Button onClick={() => void toggleLike()} type="button" variant="secondary">
                {guide.likedByMe ? "♥ Curtido" : "♡ Curtir"} ({guide.likeCount})
              </Button>
              <Button onClick={() => void toggleFavorite()} type="button" variant="secondary">
                {guide.favoritedByMe ? "★ Salvo" : "☆ Salvar"} ({guide.favoriteCount})
              </Button>
              <Button onClick={() => void share()} type="button" variant="ghost">
                Compartilhar
              </Button>
            </div>
          ) : null}
          {notice ? <p className="charm-guide-detail__notice">{notice}</p> : null}
        </header>

        <ol className="charm-guide-steps">
          {guide.steps.map((step) => (
            <li className="charm-guide-step" key={step.id}>
              <h2>
                Etapa {step.position}
                {step.hunt ? ` — ${step.hunt.name}` : step.title ? ` — ${step.title}` : ""}
              </h2>
              {step.hunt ? (
                <p>
                  Hunt: <Link to={`/hunts/${step.hunt.slug}`}>{step.hunt.name}</Link>
                </p>
              ) : (
                <p>Etapa sem Hunt associada.</p>
              )}
              <ul className="charm-guide-creatures">
                {step.creatures.map((creature) => (
                  <li key={`${step.id}-${creature.id}`}>
                    <CatalogImage
                      alt=""
                      className="charm-guide-creature__art"
                      name={creature.name}
                      src={resolveCreatureImage(creature.image, creature.slug, creature.name)}
                    />
                    <div>
                      <strong>{creature.name}</strong>
                      <span>
                        {creature.charmPoints != null ? `${creature.charmPoints} CP` : "CP não informado"}
                        {creature.repeatedFromEarlierStep ? " · já contada em etapa anterior" : ""}
                      </span>
                    </div>
                    {guide.status === "PUBLISHED" ? (
                      <Button
                        disabled={!isAuthenticated}
                        onClick={() => void toggleCreature(creature.id, creature.completed)}
                        type="button"
                        variant={creature.completed ? "secondary" : "ghost"}
                      >
                        {creature.completed ? "Concluída" : "Marcar"}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        {guide.status === "PUBLISHED" ? (
          <section className="charm-guide-comments" aria-labelledby="guide-comments-title">
            <h2 id="guide-comments-title">Comunidade</h2>
            {isAuthenticated ? (
              <div className="comment-box">
                <input
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Comente sobre este guia..."
                  value={comment}
                />
                <Button onClick={() => void sendComment()} type="button">
                  Enviar
                </Button>
              </div>
            ) : (
              <p>
                <Link to="/login">Entre na conta</Link> para comentar.
              </p>
            )}
            <ul>
              {comments.map((item) => (
                <li key={item.id}>
                  <strong>{item.author.name}</strong>
                  <p>{item.content}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageContainer>
    </div>
  );
}

function ButtonLinkBack() {
  return (
    <p>
      <Link to="/bestiary">← Voltar ao Bestiário</Link>
    </p>
  );
}
