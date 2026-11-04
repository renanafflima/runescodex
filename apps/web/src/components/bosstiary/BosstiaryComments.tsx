import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { Button } from "../ui/Button";
import { ApiError, describeApiError } from "../../services/api/errors";
import {
  createBosstiaryComment,
  deleteBosstiaryComment,
  likeBosstiaryComment,
  listBosstiaryComments,
  unlikeBosstiaryComment,
  updateBosstiaryComment,
  type BosstiaryComment,
  type BosstiaryCommentPage,
} from "../../services/api/bosstiary-comments";

function commentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Entre na sua conta para comentar.";
    if (error.status === 403) return "Você não pode alterar este comentário.";
    if (error.status === 404) return "Comentário ou boss não encontrado.";
    if (error.status === 409) return "Você já curtiu este comentário.";
    if (error.status === 400) return error.message || "Comentário inválido.";
  }
  return describeApiError(error);
}

export function BosstiaryComments({ slug }: { slug: string }) {
  const { isAuthenticated, user } = useAuth();
  const [page, setPage] = useState<BosstiaryCommentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPage(await listBosstiaryComments(slug));
    } catch (err) {
      setPage(null);
      setError(commentError(err));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      setNotice("Escreva um comentário antes de enviar.");
      return;
    }
    setPending("create");
    setNotice("");
    try {
      await createBosstiaryComment(slug, content);
      setDraft("");
      setPage(await listBosstiaryComments(slug));
    } catch (err) {
      setNotice(commentError(err));
    } finally {
      setPending("");
    }
  }

  const comments = page?.items ?? [];

  return (
    <section className="hunt-comments bosstiary-comments" aria-labelledby="bosstiary-comments-title">
      <div className="hunt-comments__head">
        <h2 id="bosstiary-comments-title">Comentários da comunidade</h2>
        <span>{loading ? "Carregando" : `${page?.commentCount ?? 0} comentários`}</span>
      </div>
      {isAuthenticated ? (
        <form className="hunt-comments__form" onSubmit={submitNew}>
          <label className="sr-only" htmlFor="bosstiary-comment-draft">
            Escreva um comentário...
          </label>
          <textarea
            className="field__control hunt-comments__input"
            id="bosstiary-comment-draft"
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva um comentário..."
            value={draft}
          />
          <Button disabled={Boolean(pending)} loading={pending === "create"} type="submit">
            Comentar
          </Button>
        </form>
      ) : (
        <p className="hunt-comments__login">
          Entre na sua conta para comentar. <Link to="/login">Entrar</Link>
        </p>
      )}
      {notice ? (
        <p className="hunt-comments__notice" role="alert">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <CatalogLoading label="Carregando comentários" />
      ) : error ? (
        <CatalogError description={error} onRetry={() => void load()} title="Não foi possível carregar os comentários" />
      ) : comments.length === 0 ? (
        <p className="hunt-comments__empty">Nenhum comentário.</p>
      ) : (
        <ol className="hunt-comments__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentCard
                comment={comment}
                currentUserId={user?.id}
                onDelete={() => void deleteBosstiaryComment(slug, comment.id).then(load)}
                onLike={() =>
                  void (comment.likedByMe ? unlikeBosstiaryComment(slug, comment.id) : likeBosstiaryComment(slug, comment.id)).then(load)
                }
                onUpdate={(content) => void updateBosstiaryComment(slug, comment.id, content).then(load)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CommentCard({
  comment,
  currentUserId,
  onDelete,
  onLike,
  onUpdate,
}: {
  comment: BosstiaryComment;
  currentUserId?: string;
  onDelete: () => void;
  onLike: () => void;
  onUpdate: (content: string) => void;
}) {
  const mine = Boolean(currentUserId && comment.user.id === currentUserId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  return (
    <article className="hunt-comments__card">
      <header className="hunt-comments__meta">
        <strong>{comment.user.name || "Jogador"}</strong>
        {comment.isEdited && !comment.isDeleted ? <span>editado</span> : null}
      </header>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate(draft.trim());
            setEditing(false);
          }}
        >
          <label className="sr-only" htmlFor={`edit-${comment.id}`}>
            Editar comentário
          </label>
          <textarea
            className="field__control hunt-comments__input"
            id={`edit-${comment.id}`}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          <Button type="submit">Salvar</Button>
        </form>
      ) : (
        <p>{comment.content}</p>
      )}
      <div className="hunt-comments__actions">
        {!comment.isDeleted ? (
          <Button onClick={onLike} type="button" variant="ghost">
            {comment.likedByMe ? "Descurtir" : "Curtir"} · {comment.likesCount}
          </Button>
        ) : null}
        {mine && !comment.isDeleted ? (
          <>
            <Button onClick={() => setEditing(true)} type="button" variant="ghost">
              Editar
            </Button>
            <Button onClick={onDelete} type="button" variant="danger">
              Excluir
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
