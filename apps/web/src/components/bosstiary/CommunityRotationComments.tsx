import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { Button } from "../ui/Button";
import { COMMUNITY_COMMENT_MAX, authorLabel, formatCommunityWhen } from "../../domain/bosstiary-community";
import { ApiError, describeApiError } from "../../services/api/errors";
import {
  createCommunityRotationComment,
  deleteCommunityRotationComment,
  likeCommunityRotationComment,
  listCommunityRotationComments,
  unlikeCommunityRotationComment,
  updateCommunityRotationComment,
  type CommunityRotationComment,
  type CommunityRotationCommentPage,
} from "../../services/api/community-rotations";

type CommunityRotationCommentsProps = {
  rotationId: string;
};

function commentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") return describeApiError(error);
    if (error.status === 401) return "Entre na sua conta para comentar.";
    if (error.status === 403) return "Você não pode alterar este comentário.";
    if (error.status === 404) return "Comentário ou rotação não encontrado.";
    if (error.status === 409) return "Você já curtiu este comentário.";
    if (error.status === 400) return error.message || "Comentário inválido.";
  }
  return describeApiError(error);
}

const INITIAL_VISIBLE_COMMENTS = 10;

export function CommunityRotationComments({ rotationId }: CommunityRotationCommentsProps) {
  const { isAuthenticated, user } = useAuth();
  const [page, setPage] = useState<CommunityRotationCommentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState("");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    setError("");
    try {
      const result = await listCommunityRotationComments(rotationId);
      setPage(result);
    } catch (err) {
      if (mode === "initial") {
        setPage(null);
        setError(commentError(err));
      } else {
        throw err;
      }
    } finally {
      if (mode === "initial") setLoading(false);
    }
  }, [rotationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<unknown>) {
    if (pending) return;
    setPending(key);
    setNotice("");
    try {
      await action();
      await load("refresh");
    } catch (err) {
      setNotice(commentError(err));
    } finally {
      setPending("");
    }
  }

  function submitNew(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      setNotice("Escreva um comentário antes de enviar.");
      return;
    }
    void run("create", async () => {
      await createCommunityRotationComment(rotationId, content);
      setDraft("");
    });
  }

  function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!replyTo) return;
    const content = replyDraft.trim();
    if (!content) {
      setNotice("Escreva uma resposta antes de enviar.");
      return;
    }
    const parentId = replyTo;
    void run("reply", async () => {
      await createCommunityRotationComment(rotationId, content, parentId);
      setReplyTo(null);
      setReplyDraft("");
    });
  }

  function submitEdit(event: FormEvent, commentId: string) {
    event.preventDefault();
    const content = editDraft.trim();
    if (!content) {
      setNotice("O comentário não pode ficar vazio.");
      return;
    }
    void run(`edit:${commentId}`, async () => {
      await updateCommunityRotationComment(rotationId, commentId, content);
      setEditingId(null);
      setEditDraft("");
    });
  }

  const busy = pending !== "";
  const comments = page?.items ?? [];
  const visibleComments = expanded ? comments : comments.slice(0, INITIAL_VISIBLE_COMMENTS);
  const canExpand = !expanded && comments.length > 3;

  return (
    <section className="hunt-comments bosstiary-community-comments" aria-labelledby="community-rotation-comments-title">
      <div className="hunt-comments__head">
        <h2 id="community-rotation-comments-title">Comentários</h2>
        <span>{loading ? "Carregando" : `${page?.commentCount ?? 0} comentários`}</span>
      </div>

      <div className="hunt-comments__scroll">
        {notice ? (
          <p className="hunt-comments__notice" role="alert">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <CatalogLoading label="Carregando comentários" />
        ) : error ? (
          <CatalogError
            description={error}
            onRetry={() => void load()}
            title="Não foi possível carregar os comentários"
          />
        ) : comments.length === 0 ? (
          <p className="hunt-comments__empty">Nenhum comentário ainda. Seja o primeiro a compartilhar sua experiência.</p>
        ) : (
          <>
            <ol className={`hunt-comments__list${expanded ? " hunt-comments__list--expanded" : ""}`}>
              {visibleComments.map((comment) => (
                <li key={comment.id}>
                  <CommentCard
                    busy={busy}
                    comment={comment}
                    currentUserId={user?.id}
                    editDraft={editDraft}
                    editing={editingId === comment.id}
                    onCancelEdit={() => {
                      setEditingId(null);
                      setEditDraft("");
                    }}
                    onChangeEdit={setEditDraft}
                    onDelete={() =>
                      void run(`delete:${comment.id}`, () =>
                        deleteCommunityRotationComment(rotationId, comment.id),
                      )
                    }
                    onEdit={() => {
                      setEditingId(comment.id);
                      setEditDraft(comment.isDeleted ? "" : comment.content);
                      setReplyTo(null);
                    }}
                    onLike={() =>
                      void run(`like:${comment.id}`, () =>
                        comment.likedByMe
                          ? unlikeCommunityRotationComment(rotationId, comment.id)
                          : likeCommunityRotationComment(rotationId, comment.id),
                      )
                    }
                    onReply={
                      user
                        ? () => {
                            setReplyTo(comment.id);
                            setReplyDraft("");
                            setEditingId(null);
                          }
                        : undefined
                    }
                    onSubmitEdit={(event) => submitEdit(event, comment.id)}
                    pending={pending}
                  />
                  {replyTo === comment.id ? (
                    <form className="hunt-comments__form hunt-comments__reply-form" onSubmit={submitReply}>
                      <label className="sr-only" htmlFor={`community-reply-${comment.id}`}>
                        Escreva uma resposta
                      </label>
                      <textarea
                        className="field__control hunt-comments__input"
                        id={`community-reply-${comment.id}`}
                        maxLength={COMMUNITY_COMMENT_MAX}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        placeholder="Escreva uma resposta..."
                        value={replyDraft}
                      />
                      <Button disabled={busy} loading={pending === "reply"} type="submit">
                        Responder
                      </Button>
                    </form>
                  ) : null}
                  {comment.replies.length ? (
                    <ol className="hunt-comments__replies">
                      {comment.replies.map((reply) => (
                        <li key={reply.id}>
                          <CommentCard
                            busy={busy}
                            comment={reply}
                            currentUserId={user?.id}
                            editDraft={editDraft}
                            editing={editingId === reply.id}
                            onCancelEdit={() => {
                              setEditingId(null);
                              setEditDraft("");
                            }}
                            onChangeEdit={setEditDraft}
                            onDelete={() =>
                              void run(`delete:${reply.id}`, () =>
                                deleteCommunityRotationComment(rotationId, reply.id),
                              )
                            }
                            onEdit={() => {
                              setEditingId(reply.id);
                              setEditDraft(reply.isDeleted ? "" : reply.content);
                            }}
                            onLike={() =>
                              void run(`like:${reply.id}`, () =>
                                reply.likedByMe
                                  ? unlikeCommunityRotationComment(rotationId, reply.id)
                                  : likeCommunityRotationComment(rotationId, reply.id),
                              )
                            }
                            onSubmitEdit={(event) => submitEdit(event, reply.id)}
                            pending={pending}
                            reply
                          />
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </li>
              ))}
            </ol>
            {canExpand ? (
              <Button
                className="hunt-comments__expand"
                onClick={() => setExpanded(true)}
                type="button"
                variant="ghost"
              >
                Ver todos os comentários ({page?.commentCount ?? comments.length})
              </Button>
            ) : null}
          </>
        )}
      </div>

      {isAuthenticated ? (
        <form className="hunt-comments__form hunt-comments__form--pinned" onSubmit={submitNew}>
          <label className="sr-only" htmlFor="community-rotation-comment-draft">
            Escreva um comentário...
          </label>
          <textarea
            className="field__control hunt-comments__input"
            id="community-rotation-comment-draft"
            maxLength={COMMUNITY_COMMENT_MAX}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva um comentário..."
            value={draft}
          />
          <Button disabled={busy} loading={pending === "create"} type="submit">
            Comentar
          </Button>
        </form>
      ) : (
        <p className="hunt-comments__login hunt-comments__login--pinned">
          Entre na sua conta para comentar. <Link to="/login">Entrar</Link>
        </p>
      )}
    </section>
  );
}

function CommentCard({
  busy,
  comment,
  currentUserId,
  editDraft,
  editing,
  onCancelEdit,
  onChangeEdit,
  onDelete,
  onEdit,
  onLike,
  onReply,
  onSubmitEdit,
  pending,
  reply = false,
}: {
  busy: boolean;
  comment: CommunityRotationComment;
  currentUserId?: string;
  editDraft: string;
  editing: boolean;
  onCancelEdit: () => void;
  onChangeEdit: (value: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onLike: () => void;
  onReply?: () => void;
  onSubmitEdit: (event: FormEvent) => void;
  pending: string;
  reply?: boolean;
}) {
  const mine = Boolean(currentUserId && comment.user.id === currentUserId);
  const likeKey = `like:${comment.id}`;
  return (
    <article className={reply ? "hunt-comments__card hunt-comments__card--reply" : "hunt-comments__card"}>
      <header className="hunt-comments__meta">
        <strong>{authorLabel(comment.user.name)}</strong>
        <time dateTime={comment.createdAt}>{formatCommunityWhen(comment.createdAt)}</time>
        {comment.isEdited && !comment.isDeleted ? <span>editado</span> : null}
      </header>
      {editing ? (
        <form onSubmit={onSubmitEdit}>
          <label className="sr-only" htmlFor={`community-edit-${comment.id}`}>
            Editar comentário
          </label>
          <textarea
            className="field__control hunt-comments__input"
            id={`community-edit-${comment.id}`}
            maxLength={COMMUNITY_COMMENT_MAX}
            onChange={(event) => onChangeEdit(event.target.value)}
            value={editDraft}
          />
          <div className="hunt-comments__actions">
            <Button disabled={busy} loading={pending === `edit:${comment.id}`} type="submit">
              Salvar
            </Button>
            <Button disabled={busy} onClick={onCancelEdit} type="button" variant="ghost">
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <p>{comment.content}</p>
      )}
      <div className="hunt-comments__actions">
        {!comment.isDeleted ? (
          <Button
            disabled={busy || !currentUserId}
            loading={pending === likeKey}
            onClick={onLike}
            type="button"
            variant="ghost"
          >
            {comment.likedByMe ? "Descurtir" : "Curtir"} · {comment.likesCount}
          </Button>
        ) : (
          <span>{comment.likesCount} curtidas</span>
        )}
        {!comment.isDeleted && onReply ? (
          <Button disabled={busy} onClick={onReply} type="button" variant="ghost">
            Responder
          </Button>
        ) : null}
        {mine && !comment.isDeleted ? (
          <>
            <Button disabled={busy} onClick={onEdit} type="button" variant="ghost">
              Editar
            </Button>
            <Button
              disabled={busy}
              loading={pending === `delete:${comment.id}`}
              onClick={onDelete}
              type="button"
              variant="danger"
            >
              Excluir
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
