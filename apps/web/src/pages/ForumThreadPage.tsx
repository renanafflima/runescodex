import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, ButtonLink } from "../components/ui/Button";
import { Textarea } from "../components/ui/FormControls";
import { Toast } from "../components/ui/Toast";
import {
  FORUM_BODY_MAX,
  forumAuthorLabel,
  forumCategoryLabel,
  formatForumRelativeTime,
} from "../domain/forum";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { describeApiError } from "../services/api/errors";
import {
  closeForumThread,
  createForumReply,
  getForumThread,
  type ForumComment,
  type ForumThread,
} from "../services/api/forum";

export function ForumThreadPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const requests = useLatestRequest();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(
    location.state &&
      typeof location.state === "object" &&
      "created" in location.state &&
      location.state.created
      ? {
          title: "Discussão publicada",
          message: "Sua discussão já está visível para a comunidade.",
          tone: "success",
        }
      : null,
  );

  const loadThread = useCallback(async () => {
    const current = requests.start();
    setLoading(true);
    setError("");
    try {
      const result = await getForumThread(id);
      if (!current()) return;
      setThread(result);
      setComments(result.comments);
    } catch (err) {
      if (!current()) return;
      setThread(null);
      setComments([]);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [id, requests]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = reply.trim();
    if (!body) {
      setReplyError("Escreva uma resposta antes de enviar.");
      return;
    }
    if (body.length > FORUM_BODY_MAX) {
      setReplyError(`A resposta pode ter no máximo ${FORUM_BODY_MAX} caracteres.`);
      return;
    }
    setSubmitting(true);
    setReplyError("");
    try {
      const result = await createForumReply(id, { body });
      setThread(result);
      setComments(result.comments);
      setReply("");
      setNotice({
        title: "Resposta publicada",
        message: "Sua resposta foi adicionada à discussão.",
        tone: "success",
      });
    } catch (err) {
      setNotice({
        title: "Não foi possível responder",
        message: describeApiError(err),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!thread) return;
    setClosing(true);
    try {
      const result = await closeForumThread(thread.id);
      setThread(result);
      setComments(result.comments);
    } catch (err) {
      setNotice({
        title: "Não foi possível encerrar",
        message: describeApiError(err),
        tone: "error",
      });
    } finally {
      setClosing(false);
    }
  }

  const isAuthor = Boolean(user?.id && thread && (thread.author.id === user.id || thread.createdByUserId === user.id));

  return (
    <div className="forum-page forum-page--thread">
      <PageContainer className="forum-page__inner forum-thread" size="narrow">
        <Link className="forum-back" to="/forum">
          ← Voltar ao fórum
        </Link>
        {loading ? (
          <CatalogLoading label="Carregando discussão" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void loadThread()} />
        ) : !thread ? (
          <CatalogEmpty description="Esta discussão não foi encontrada." title="Discussão indisponível" />
        ) : (
          <>
            <article className="forum-panel forum-thread__post">
              <span className="forum-badge">{forumCategoryLabel(thread.category)}</span>
              <h1>{thread.title}</h1>
              <p className="forum-thread__meta">
                por {forumAuthorLabel(thread.author.id, user?.id)} · {formatForumRelativeTime(thread.createdAt)}
                {thread.status === "closed" ? " · Encerrada" : ""}
              </p>
              <div className="forum-thread__body">{thread.body}</div>
              {isAuthor && thread.status === "open" ? (
                <Button disabled={closing} loading={closing} onClick={() => void handleClose()} variant="ghost">
                  Encerrar discussão
                </Button>
              ) : null}
            </article>

            <section className="forum-panel">
              <h2>{thread.replyCount} resposta{thread.replyCount === 1 ? "" : "s"}</h2>
              {comments.length === 0 ? (
                <p className="forum-muted">Ainda não há respostas. Seja o primeiro a ajudar.</p>
              ) : (
                comments.map((comment) => (
                  <article className="forum-reply" key={comment.id}>
                    <p>{comment.text}</p>
                    <span>
                      {forumAuthorLabel(comment.author.id, user?.id)} · {formatForumRelativeTime(comment.createdAt)}
                    </span>
                  </article>
                ))
              )}
            </section>

            {thread.status === "closed" ? (
              <p className="forum-muted">Esta discussão foi encerrada e não recebe novas respostas.</p>
            ) : isAuthenticated ? (
              <form className="forum-panel forum-reply-form" onSubmit={handleReply}>
                <Textarea
                  error={replyError}
                  label="Responder"
                  maxLength={FORUM_BODY_MAX}
                  onChange={(event) => {
                    setReply(event.target.value);
                    setReplyError("");
                  }}
                  placeholder="Escreva uma resposta objetiva."
                  rows={6}
                  value={reply}
                />
                <Button disabled={submitting} loading={submitting} type="submit">
                  Publicar resposta
                </Button>
              </form>
            ) : (
              <ButtonLink state={{ from: `/forum/${thread.id}` }} to="/login">
                Entrar para responder
              </ButtonLink>
            )}
          </>
        )}
      </PageContainer>
      {notice ? (
        <Toast
          message={notice.message}
          onClose={() => setNotice(null)}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}
    </div>
  );
}
