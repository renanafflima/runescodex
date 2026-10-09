import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, ButtonLink } from "../components/ui/Button";
import { SearchInput } from "../components/ui/FormControls";
import {
  FORUM_CATEGORIES,
  FORUM_SEARCH_MAX,
  featuredForumThreads,
  forumAuthorLabel,
  forumCategoryLabel,
  forumExcerpt,
  forumReplyCount,
  formatForumRelativeTime,
  normalizeForumCategory,
} from "../domain/forum";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { assetUrl } from "../lib/assets";
import { describeApiError } from "../services/api/errors";
import { listForumThreads, type ForumThread } from "../services/api/forum";

export function ForumPage() {
  const { isAuthenticated, user } = useAuth();
  const requests = useLatestRequest();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = normalizeForumCategory(searchParams.get("category"));
  const mine = searchParams.get("mine") === "1";
  const search = (searchParams.get("q") ?? "").slice(0, FORUM_SEARCH_MAX);
  const [draft, setDraft] = useState(search);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const loadThreads = useCallback(
    async (nextPage = 1) => {
      const current = requests.start();
      if (nextPage === 1) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await listForumThreads({
          page: nextPage,
          limit: 20,
          category: category ?? undefined,
          search: search || undefined,
          authorId: mine && user?.id ? user.id : undefined,
        });
        if (!current()) return;
        setThreads((currentThreads) =>
          nextPage === 1 ? result.items : [...currentThreads, ...result.items],
        );
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (err) {
        if (!current()) return;
        if (nextPage === 1) {
          setThreads([]);
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
    [category, mine, requests, search, user?.id],
  );

  useEffect(() => {
    if (mine && !isAuthenticated) return;
    void loadThreads(1);
  }, [isAuthenticated, loadThreads, mine]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const value = draft.trim().slice(0, FORUM_SEARCH_MAX);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next);
  }

  function setCategoryFilter(nextCategory: string | null) {
    const next = new URLSearchParams(searchParams);
    if (nextCategory && nextCategory === category) {
      next.delete("category");
    } else if (nextCategory) {
      next.set("category", nextCategory);
    } else {
      next.delete("category");
    }
    setSearchParams(next);
  }

  const featured = useMemo(() => featuredForumThreads(threads), [threads]);
  const createTo = isAuthenticated ? "/forum/new" : "/login";
  const createState = isAuthenticated ? undefined : { from: "/forum/new" };
  const profileTo = isAuthenticated ? "/profile" : "/login";
  const mineTo = isAuthenticated ? "/forum?mine=1" : "/login";
  const mineState = isAuthenticated ? undefined : { from: "/forum?mine=1" };

  return (
    <div className="forum-page">
      <PageContainer className="forum-page__inner" size="wide">
        <header className="forum-top">
          <div className="forum-brand">
            <img
              alt=""
              className="forum-brand__mark"
              height="48"
              src={assetUrl("images/forum/hero_forum.png")}
              width="48"
            />
            <div>
              <h1>RuneCodex</h1>
              <p>Fórum · Comunidade · Conhecimento</p>
            </div>
          </div>
          <nav className="forum-top__actions" aria-label="Atalhos do fórum">
            <Link className="forum-ghost" to={profileTo} state={isAuthenticated ? undefined : { from: "/profile" }}>
              Meu perfil
            </Link>
            <Link className="forum-ghost" to={mineTo} state={mineState}>
              Minhas discussões
            </Link>
          </nav>
        </header>

        <section className="forum-hero" aria-labelledby="forum-title">
          <img alt="" src={assetUrl("images/forum/hero_forum.png")} />
          <div className="forum-hero__copy">
            <span className="forum-hero__kicker">Comunidade RuneCodex</span>
            <h2 id="forum-title">FÓRUM</h2>
            <p>Compartilhe conhecimento, tire dúvidas e ajude outros aventureiros.</p>
          </div>
        </section>

        <form className="forum-search-row" onSubmit={applySearch}>
          <SearchInput
            maxLength={FORUM_SEARCH_MAX}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pesquise por uma discussão, hunt, criatura ou assunto..."
            value={draft}
          />
          <Button className="forum-search-row__submit" type="submit" variant="secondary">
            Pesquisar
          </Button>
        </form>

        <section className="forum-composer">
          <div>
            <strong>Tem algo para compartilhar?</strong>
            <p>Crie uma discussão, ajude outro aventureiro e faça parte da comunidade.</p>
          </div>
          <ButtonLink className="forum-composer__cta" state={createState} to={createTo}>
            Criar nova discussão
          </ButtonLink>
        </section>

        <div className="forum-layout">
          <div>
            <section className="forum-panel">
              <div className="forum-panel__head">
                <div>
                  <h3>Categorias</h3>
                  <p>Encontre rapidamente o assunto que você procura.</p>
                </div>
              </div>
              <div className="forum-categories">
                {FORUM_CATEGORIES.map((item) => {
                  const selected = category === item.id;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`forum-category ${selected ? "forum-category--active" : ""}`}
                      key={item.id}
                      onClick={() => setCategoryFilter(item.id)}
                      type="button"
                    >
                      <img alt="" src={assetUrl(item.image)} />
                      <span className="forum-category__content">
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="forum-panel">
              <div className="forum-panel__head">
                <div>
                  <h3>Destaques</h3>
                  <p>Discussões reais com mais respostas da comunidade.</p>
                </div>
                <span className="forum-panel__count">Em destaque</span>
              </div>
              {loading ? (
                <CatalogLoading label="Carregando destaques" />
              ) : featured.length === 0 ? (
                <p className="forum-muted">Ainda não há discussões para destacar.</p>
              ) : (
                <div className="forum-featured">
                  {featured.map((thread) => (
                    <Link className="forum-feature" key={thread.id} to={`/forum/${thread.id}`}>
                      <span className="forum-feature__tag">{forumCategoryLabel(thread.category)}</span>
                      <h4>{thread.title}</h4>
                      <p>{forumExcerpt(thread.body)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="forum-panel">
              <div className="forum-panel__head">
                <div>
                  <h3>
                    Discussões <span>recentes</span>
                  </h3>
                  <p>
                    {mine
                      ? "Discussões criadas por você."
                      : category
                        ? `Conversas em ${forumCategoryLabel(category)}.`
                        : "As conversas mais recentes da comunidade."}
                  </p>
                </div>
                <button className="forum-panel__count" onClick={() => setSearchParams({})} type="button">
                  Ver todas →
                </button>
              </div>

              {mine && !isAuthenticated ? (
                <CatalogEmpty
                  action={
                    <ButtonLink state={{ from: "/forum?mine=1" }} to="/login">
                      Entrar para ver
                    </ButtonLink>
                  }
                  description="Entre na sua conta para listar as discussões que você criou."
                  title="Autenticação necessária"
                />
              ) : loading ? (
                <CatalogLoading label="Carregando discussões" />
              ) : error ? (
                <CatalogError description={error} onRetry={() => void loadThreads(1)} />
              ) : threads.length === 0 ? (
                <CatalogEmpty
                  action={
                    <ButtonLink state={createState} to={createTo}>
                      Criar discussão
                    </ButtonLink>
                  }
                  description="Nenhuma discussão corresponde aos filtros atuais."
                  title="Nenhuma discussão encontrada"
                />
              ) : (
                <>
                  {threads.map((thread) => (
                    <Link className="forum-discussion" key={thread.id} to={`/forum/${thread.id}`}>
                      <div>
                        <h4>{thread.title}</h4>
                        <p>{forumExcerpt(thread.body)}</p>
                        <div className="forum-meta">
                          <span className="forum-badge">{forumCategoryLabel(thread.category)}</span>
                          <span>por {forumAuthorLabel(thread.author.id, user?.id)}</span>
                          <span>{formatForumRelativeTime(thread.createdAt)}</span>
                        </div>
                      </div>
                      <div className="forum-replies">
                        <strong>{forumReplyCount(thread)}</strong>
                        respostas
                      </div>
                    </Link>
                  ))}
                  {hasMore ? (
                    <div className="forum-more">
                      <Button
                        loading={loadingMore}
                        onClick={() => void loadThreads(page + 1)}
                        variant="secondary"
                      >
                        Carregar mais
                      </Button>
                    </div>
                  ) : (
                    <p className="forum-muted">{total} discussão{total === 1 ? "" : "ões"}</p>
                  )}
                </>
              )}
            </section>
          </div>

          <aside className="forum-aside">
            <section className="forum-panel">
              <h3 className="forum-aside__title">Como aproveitar o fórum</h3>
              <div className="forum-rule" />
              <div className="forum-tip">
                <strong>Compartilhe conhecimento</strong>
                <p>Uma boa resposta pode economizar horas de hunt para outro aventureiro.</p>
              </div>
              <div className="forum-tip">
                <strong>Seja específico</strong>
                <p>Informe level, vocação, equipamentos e objetivo quando pedir ajuda.</p>
              </div>
              <div className="forum-tip">
                <strong>Contribua com a comunidade</strong>
                <p>Guias, experiências e descobertas também ajudam a construir o Codex.</p>
              </div>
            </section>
            <section className="forum-panel">
              <h3 className="forum-aside__title">Atalhos</h3>
              <div className="forum-rule" />
              <div className="forum-stats">
                <Link className="forum-stat" to="/forum">
                  <strong>5</strong>
                  <span>Categorias</span>
                </Link>
                <Link className="forum-stat" to={createTo} state={createState}>
                  <strong>+</strong>
                  <span>Criar discussão</span>
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
