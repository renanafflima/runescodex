import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadBosstiaryCatalog } from "../../domain/bosstiary-catalog";
import { bossPartyLabel } from "../../domain/bosstiary";
import {
  getAdminBossViews,
  getAdminCreatures,
  getAdminForum,
  getAdminForumThreads,
  getAdminHuntCatalog,
  getAdminHuntQuality,
  getAdminHuntRankings,
  getAdminRankings,
  getAdminSearchMisses,
  getAdminSeries,
  getAdminUser,
  getAdminUsers,
} from "../../services/api/admin-portal";
import {
  AdminState,
  Pager,
  PeriodFilters,
  TrendChart,
  adminError,
  formatAdminDate,
  formatAdminNumber,
  useAdminPeriod,
} from "./admin-ui";

function moneyAmount(currency: string, amountMinor: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function AdminHuntsPage() {
  const period = useAdminPeriod();
  const [params] = useSearchParams();
  const catalogFromUrl = params.get("search") || "";
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof getAdminHuntRankings>> | null>(null);
  const [quality, setQuality] = useState<Awaited<ReturnType<typeof getAdminHuntQuality>> | null>(null);
  const [catalogSearch, setCatalogSearch] = useState(catalogFromUrl);
  const [catalogQuery, setCatalogQuery] = useState(catalogFromUrl);
  const [catalogVocation, setCatalogVocation] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof getAdminHuntCatalog>> | null>(null);
  const [series, setSeries] = useState<Array<{ start: string; value: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!period.ready) {
      setLoading(false);
      setError("Informe o início e o fim do período.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextRanking, nextQuality, nextSeries, nextCatalog] = await Promise.all([
        getAdminHuntRankings({ ...period.query, order, page }),
        getAdminHuntQuality({ page: 1 }),
        getAdminSeries("huntViews", period.query),
        getAdminHuntCatalog({ search: catalogQuery, vocation: catalogVocation, page: catalogPage }),
      ]);
      setRanking(nextRanking);
      setQuality(nextQuality);
      setSeries(nextSeries.buckets);
      setCatalog(nextCatalog);
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [catalogPage, catalogQuery, catalogVocation, order, page, period.query, period.ready]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCatalogSearch(catalogFromUrl);
    setCatalogQuery(catalogFromUrl);
    setCatalogPage(1);
  }, [catalogFromUrl]);

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Hunts e conteúdo</h1>
          <p className="admin-page__lead">{ranking?.definition}</p>
        </div>
        <PeriodFilters />
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        <section className="admin-panel">
          <h2>Visualizações</h2>
          <p className="admin-note">
            Medição: {ranking?.measurement}. Início da cobertura: {formatAdminDate(ranking?.coverageStartedAt)}.
          </p>
          <TrendChart buckets={series} />
        </section>
        <div className="admin-filters">
          <button onClick={() => { setOrder("desc"); setPage(1); }} type="button">Mais usadas</button>
          <button onClick={() => { setOrder("asc"); setPage(1); }} type="button">Menos usadas</button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Hunt</th>
                <th>Local</th>
                <th>Visualizações</th>
                <th>Usuários</th>
                <th>Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {ranking?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.position}</td>
                  <td><Link to={`/hunts/${item.slug}`}>{item.name}</Link></td>
                  <td>{item.location}</td>
                  <td>{formatAdminNumber(item.views)}</td>
                  <td>{formatAdminNumber(item.readers)}</td>
                  <td>{formatAdminDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager limit={ranking?.limit || 20} onPage={setPage} page={page} total={ranking?.total || 0} />
        <section className="admin-panel">
          <h2>Catálogo</h2>
          <p className="admin-note">Busca no catálogo oficial. Esta pesquisa administrativa não entra nas buscas sem resultado.</p>
          <form
            className="admin-filters"
            onSubmit={(event) => {
              event.preventDefault();
              setCatalogPage(1);
              setCatalogQuery(catalogSearch.trim());
            }}
          >
            <label>
              Nome, local ou criatura
              <input onChange={(event) => setCatalogSearch(event.target.value)} value={catalogSearch} />
            </label>
            <label>
              Vocação
              <select onChange={(event) => { setCatalogVocation(event.target.value); setCatalogPage(1); }} value={catalogVocation}>
                <option value="">Todas</option>
                <option value="EK">EK</option>
                <option value="RP">RP</option>
                <option value="ED">ED</option>
                <option value="MS">MS</option>
                <option value="EM">EM</option>
              </select>
            </label>
            <button type="submit">Pesquisar</button>
          </form>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Hunt</th>
                  <th>Local</th>
                  <th>Vocações</th>
                  <th>Atualizada</th>
                  <th>Contribuições</th>
                  <th>Chamados</th>
                </tr>
              </thead>
              <tbody>
                {catalog?.items.map((item) => (
                  <tr key={item.id}>
                    <td><Link to={`/hunts/${item.slug}`}>{item.name}</Link></td>
                    <td>{item.location || "—"}</td>
                    <td>{item.vocations.map((row) => `${row.vocation} ${row.levelMin}+`).join(", ") || "—"}</td>
                    <td>{formatAdminDate(item.updatedAt)}</td>
                    <td><Link to={`/admin/contributions?search=${encodeURIComponent(item.name)}`}>Ver fila</Link></td>
                    <td><Link to={`/admin/tickets?huntId=${item.id}`}>Chamados</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager limit={catalog?.limit || 20} onPage={setCatalogPage} page={catalogPage} total={catalog?.total || 0} />
        </section>
        <section className="admin-panel">
          <h2>Qualidade do catálogo</h2>
          <p className="admin-note">{quality?.definition}</p>
          <ul>
            {quality?.items.map((item) => (
              <li key={item.id}>
                <Link to={`/hunts/${item.slug}`}>{item.name}</Link>
                {" "}
                {[
                  item.missingDescription ? "sem descrição" : "",
                  item.missingMap ? "sem mapa" : "",
                  item.missingVocations ? "sem vocação" : "",
                  item.missingCreatures ? "sem criatura" : "",
                  item.duplicateName ? "nome repetido" : "",
                ].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      </AdminState>
    </>
  );
}

export function AdminBestiaryPage() {
  const [params] = useSearchParams();
  const searchFromUrl = params.get("search") || "";
  const [search, setSearch] = useState(searchFromUrl);
  const [applied, setApplied] = useState(searchFromUrl);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminCreatures>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await getAdminCreatures({ search: applied, page }));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setSearch(searchFromUrl);
    setApplied(searchFromUrl);
    setPage(1);
  }, [searchFromUrl]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Bestiário e criaturas</h1>
          <p className="admin-page__lead">
            O catálogo mestre é separado do progresso individual de cada jogador. Ausência de ficha de bestiário é um
            critério de atenção, não uma correção automática.
          </p>
        </div>
      </header>
      <form
        className="admin-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setApplied(search.trim());
        }}
      >
        <label>
          Nome ou identificador
          <input onChange={(event) => setSearch(event.target.value)} value={search} />
        </label>
        <button type="submit">Pesquisar</button>
      </form>
      <AdminState empty={!result?.items.length} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Criatura</th>
                <th>Campos ausentes</th>
                <th>Ficha</th>
                <th>Atualizada</th>
                <th>Chamados</th>
              </tr>
            </thead>
            <tbody>
              {result?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link to={`/bestiary/${item.slug}`}>{item.name}</Link></td>
                  <td>{item.missingFields.join(", ") || "completo"}</td>
                  <td>{item.missingBestiary ? "sem ficha" : "com ficha"}</td>
                  <td>{formatAdminDate(item.updatedAt)}</td>
                  <td><Link to={`/admin/tickets?creatureId=${item.id}`}>Chamados</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager limit={result?.limit || 20} onPage={setPage} page={page} total={result?.total || 0} />
      </AdminState>
    </>
  );
}

export function AdminBossesPage() {
  const period = useAdminPeriod();
  const [query, setQuery] = useState("");
  const [views, setViews] = useState<Record<string, number>>({});
  const [measurement, setMeasurement] = useState("");
  const catalog = useMemo(() => {
    try {
      return loadBosstiaryCatalog();
    } catch {
      return { entries: [], skipped: 0 };
    }
  }, []);
  useEffect(() => {
    if (!period.ready) return;
    let active = true;
    void getAdminBossViews(period.query)
      .then((result) => {
        if (!active) return;
        setMeasurement(result.measurement);
        setViews(Object.fromEntries(result.items.map((item) => [item.slug, item.views])));
      })
      .catch(() => {
        if (active) setMeasurement("none");
      });
    return () => {
      active = false;
    };
  }, [period.query, period.ready]);
  const visible = catalog.entries.filter((entry) => {
    const text = query.trim().toLocaleLowerCase();
    return !text || entry.name.toLocaleLowerCase().includes(text) || entry.slug.toLocaleLowerCase().includes(text);
  });
  const summary = useMemo(() => {
    const entries = catalog.entries;
    return {
      total: entries.length,
      withoutImage: entries.filter((entry) => !entry.imageUrl).length,
      withoutLocation: entries.filter((entry) => !entry.location).length,
      withoutReview: entries.filter((entry) => !entry.party || !entry.recommendedLevel).length,
    };
  }, [catalog]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Bosses</h1>
          <p className="admin-page__lead">
            O bosstiário é um catálogo estático revisado no aplicativo. Não há tabela de bosses nem requisitos inventados
            aqui. A classificação Solo, PT, Evento e level só aparece quando a revisão editorial existe.
          </p>
        </div>
      </header>
      <section className="admin-metrics">
        <article className="admin-metric"><header><span>Registros</span></header><strong>{summary.total}</strong></article>
        <article className="admin-metric"><header><span>Sem imagem</span></header><strong>{summary.withoutImage}</strong></article>
        <article className="admin-metric"><header><span>Sem localização</span></header><strong>{summary.withoutLocation}</strong></article>
        <article className="admin-metric"><header><span>Sem classificação editorial</span></header><strong>{summary.withoutReview}</strong></article>
      </section>
      <PeriodFilters />
      <p className="admin-note">
        Visualizações usam o slug do catálogo estático. Medição do período: {measurement || "—"}. Um boss sem slug não entra na contagem.
      </p>
      <form className="admin-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Nome
          <input onChange={(event) => setQuery(event.target.value)} value={query} />
        </label>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Boss</th>
              <th>Slug</th>
              <th>Local</th>
              <th>Classificação</th>
              <th>Level revisado</th>
              <th>Visualizações no período</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.slug || entry.name}>
                <td>{entry.slug ? <Link to={`/bosstiary?boss=${encodeURIComponent(entry.slug)}`}>{entry.name}</Link> : entry.name}</td>
                <td>{entry.slug || "Sem identificador estável"}</td>
                <td>{entry.location || "—"}</td>
                <td>{bossPartyLabel(entry.party) ?? "Classificação pendente"}</td>
                <td>{entry.recommendedLevel ?? "—"}</td>
                <td>{entry.slug ? formatAdminNumber(views[entry.slug] ?? (measurement === "none" ? null : 0)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AdminForumPage() {
  const period = useAdminPeriod();
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminForum>> | null>(null);
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof getAdminForumThreads>> | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [threadQuery, setThreadQuery] = useState("");
  const [threadPage, setThreadPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextForum, nextThreads] = await Promise.all([
        getAdminForum(period.query),
        getAdminForumThreads({ search: threadQuery, page: threadPage }),
      ]);
      setData(nextForum);
      setThreads(nextThreads);
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [period.query, threadPage, threadQuery]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Fórum e comunidade</h1>
          <p className="admin-page__lead">{data?.definition}</p>
        </div>
        <PeriodFilters />
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        <section className="admin-metrics">
          <article className="admin-metric"><header><span>Tópicos acumulados</span></header><strong>{formatAdminNumber(data?.topicsTotal)}</strong></article>
          <article className="admin-metric"><header><span>Tópicos no período</span></header><strong>{formatAdminNumber(data?.topics)}</strong></article>
          <article className="admin-metric"><header><span>Respostas acumuladas</span></header><strong>{formatAdminNumber(data?.repliesTotal)}</strong></article>
          <article className="admin-metric"><header><span>Respostas no período</span></header><strong>{formatAdminNumber(data?.replies)}</strong></article>
          <article className="admin-metric"><header><span>Tópicos sem resposta</span></header><strong>{formatAdminNumber(data?.unanswered)}</strong><p>Total histórico, não só o período.</p></article>
          <article className="admin-metric"><header><span>Autores no período</span></header><strong>{formatAdminNumber(data?.authors)}</strong></article>
          <article className="admin-metric"><header><span>Quem respondeu</span></header><strong>{formatAdminNumber(data?.responders)}</strong></article>
        </section>
        <p className="admin-note">
          O fórum não possui denúncias, reações nem marcação de resposta útil. Rankings de participação ficam em Rankings.
        </p>
        <form
          className="admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setThreadPage(1);
            setThreadQuery(threadSearch.trim());
          }}
        >
          <label>
            Tópico ou texto
            <input onChange={(event) => setThreadSearch(event.target.value)} value={threadSearch} />
          </label>
          <button type="submit">Pesquisar</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tópico</th>
                <th>Autor</th>
                <th>Respostas</th>
                <th>Criado</th>
              </tr>
            </thead>
            <tbody>
              {threads?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link to={`/forum/${item.id}`}>{item.title}</Link></td>
                  <td>{item.author || "Jogador"}</td>
                  <td>{item.replies}</td>
                  <td>{formatAdminDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager limit={threads?.limit || 20} onPage={setThreadPage} page={threadPage} total={threads?.total || 0} />
      </AdminState>
    </>
  );
}

export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminUsers>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await getAdminUsers({ search: applied, page }));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Usuários</h1>
          <p className="admin-page__lead">A busca encontra o personagem ativo ou o e-mail. A tabela continua mostrando só o nome público.</p>
        </div>
      </header>
      <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(search.trim()); }}>
        <label>
          Nome ou e-mail
          <input onChange={(event) => setSearch(event.target.value)} value={search} />
        </label>
        <button type="submit">Pesquisar</button>
      </form>
      <AdminState empty={!result?.items.length} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Nome</th><th>Vocação</th><th>Level</th><th>Papel</th><th>Cadastro</th></tr>
            </thead>
            <tbody>
              {result?.items.map((user) => (
                <tr key={user.id}>
                  <td><Link to={`/admin/users/${user.id}`}>{user.name || "Sem personagem ativo"}</Link></td>
                  <td>{user.vocation || "—"}</td>
                  <td>{user.level ?? "—"}</td>
                  <td>{user.role}</td>
                  <td>{formatAdminDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager limit={result?.limit || 20} onPage={setPage} page={page} total={result?.total || 0} />
      </AdminState>
    </>
  );
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const [user, setUser] = useState<Awaited<ReturnType<typeof getAdminUser>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUser(await getAdminUser(id));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <AdminState error={error} loading={loading} onRetry={() => void load()}>
      {user ? (
        <section className="admin-panel">
          <h1>{user.character?.name || "Usuário"}</h1>
          <p>Conta: {user.email}</p>
          <p>Papel: {user.role} · cadastro {formatAdminDate(user.createdAt)}</p>
          <p>
            Personagem: {user.character ? `${user.character.vocation} ${user.character.level} · ${user.character.world}` : "nenhum ativo"}
          </p>
          <p>
            Carteira oficial: {user.wallet ? `${user.wallet.points} pontos · ${user.wallet.gold} gold · ${user.wallet.diamond} diamantes` : "sem carteira"}
          </p>
          <p>Tópicos {user.forumThreads} · respostas {user.forumReplies} · contribuições {user.contributions}</p>
          <p>Chamados {user.tickets}, dos quais {user.openTickets} ainda abertos.</p>
          <p>Sessões ativas: {user.activeSessions}. O logout apaga a sessão, então isso não é um histórico de último acesso.</p>
          <h2>Equipamentos</h2>
          {(user.devices ?? []).length === 0 ? <p>Nenhum equipamento vinculado.</p> : (
            <ul>
              {(user.devices ?? []).map((device) => (
                <li key={device.id}>
                  {device.label} · {device.status} · {device.osName || "Não identificado"} · {device.clientName || "Não identificado"}
                </li>
              ))}
            </ul>
          )}
          <h2>Licenças</h2>
          {user.licenses.length === 0 ? <p>Nenhuma licença.</p> : user.licenses.map((license) => (
            <article key={license.id}>
              <p>
                <Link to={`/admin/licenses?tab=licenses&license=${license.id}`}>{license.status}</Link>
                {" · "}{license.source} · {license.term === "LIFETIME" ? "vitalícia" : "com validade"}
                {license.expiresAt ? ` · até ${formatAdminDate(license.expiresAt)}` : ""}
              </p>
              {license.payments.length === 0 ? <p>Sem pagamento associado.</p> : license.payments.map((payment) => (
                <p key={payment.id}>
                  {payment.status} · {moneyAmount(payment.currency, payment.amountMinor)} · {payment.providerPaymentId || "sem id do provedor"}
                </p>
              ))}
            </article>
          ))}
          <h2>Chamados recentes</h2>
          {user.recentTickets.length === 0 ? <p>Nenhum chamado.</p> : (
            <ul>
              {user.recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link to={`/admin/tickets/${ticket.id}`}>{ticket.protocol}</Link>
                  {" · "}{ticket.status} · {formatAdminDate(ticket.createdAt)}
                </li>
              ))}
            </ul>
          )}
          <p><Link to={`/admin/tickets?authorId=${user.id}`}>Ver todos os chamados deste usuário</Link></p>
        </section>
      ) : null}
    </AdminState>
  );
}

export function AdminAnalyticsPage() {
  const period = useAdminPeriod();
  const [metric, setMetric] = useState("contentViews");
  const [series, setSeries] = useState<Awaited<ReturnType<typeof getAdminSeries>> | null>(null);
  const [misses, setMisses] = useState<Awaited<ReturnType<typeof getAdminSearchMisses>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSeries, nextMisses] = await Promise.all([
        getAdminSeries(metric, period.query),
        getAdminSearchMisses(period.query),
      ]);
      setSeries(nextSeries);
      setMisses(nextMisses);
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [metric, period.query]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Analytics</h1>
          <p className="admin-page__lead">{series?.definition}</p>
        </div>
        <PeriodFilters />
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        <label>
          Métrica
          <select onChange={(event) => setMetric(event.target.value)} value={metric}>
            <option value="contentViews">Visualizações de conteúdo</option>
            <option value="huntViews">Hunts</option>
            <option value="forumPosts">Fórum</option>
            <option value="tickets">Chamados</option>
            <option value="contributions">Contribuições</option>
            <option value="signups">Cadastros</option>
            <option value="activeUsers">Usuários ativos</option>
          </select>
        </label>
        <p className="admin-note">Medição: {series?.measurement}. Cobertura desde {formatAdminDate(series?.coverageStartedAt)}.</p>
        <TrendChart buckets={series?.buckets || []} />
        <section className="admin-panel">
          <h2>Buscas sem resultado</h2>
          <p className="admin-note">{misses?.definition}</p>
          <ul>
            {misses?.items.map((item) => (
              <li key={`${item.category}-${item.term}`}>{item.term} · {item.category} · {item.value}</li>
            ))}
          </ul>
        </section>
      </AdminState>
    </>
  );
}

const RANKINGS = [
  { id: "forum-topics", label: "Quem cria tópicos" },
  { id: "forum-replies", label: "Quem responde" },
  { id: "approved-corrections", label: "Correções resolvidas" },
  { id: "suggestions", label: "Sugestões enviadas" },
  { id: "forum-threads", label: "Tópicos movimentados" },
  { id: "ticket-categories", label: "Categorias de chamados" },
];

export function AdminRankingsPage() {
  const period = useAdminPeriod();
  const [dimension, setDimension] = useState("forum-topics");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminRankings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(await getAdminRankings(dimension, { ...period.query, page }));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [dimension, page, period.query]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Rankings</h1>
          <p className="admin-page__lead">{result?.definition}</p>
        </div>
        <PeriodFilters />
      </header>
      <label>
        Métrica
        <select onChange={(event) => { setDimension(event.target.value); setPage(1); }} value={dimension}>
          {RANKINGS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <AdminState empty={!result?.items.length} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>#</th><th>Registro</th><th>Valor</th><th>Anterior</th><th>Variação</th></tr></thead>
            <tbody>
              {result?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.position}</td>
                  <td>{dimension.startsWith("forum-threads") ? <Link to={`/forum/${item.id}`}>{item.label}</Link> : item.label}</td>
                  <td>{formatAdminNumber(item.value)}</td>
                  <td>{item.previous === undefined ? "—" : formatAdminNumber(item.previous)}</td>
                  <td>{item.deltaPercent === undefined || item.deltaPercent === null ? "—" : `${item.deltaPercent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager limit={result?.limit || 20} onPage={setPage} page={page} total={result?.total || 0} />
      </AdminState>
    </>
  );
}
