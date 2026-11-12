import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import {
  TICKET_CATEGORY_LABEL,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "../../domain/tickets";
import { getAdminTickets } from "../../services/api/admin-portal";
import { AdminState, Pager, adminError, formatAdminDate } from "./admin-ui";

const VIEWS = [
  { id: "", label: "Todos" },
  { id: "unassigned", label: "Não atribuídos" },
  { id: "me", label: "Meus chamados" },
  { id: "OPEN", label: "Abertos" },
  { id: "IN_REVIEW", label: "Em atendimento" },
  { id: "WAITING_ON_USER", label: "Aguardando usuário" },
  { id: "WAITING_ON_STAFF", label: "Aguardando equipe" },
  { id: "RESOLVED", label: "Resolvidos" },
  { id: "REJECTED", label: "Rejeitados" },
];

const STATUSES = ["OPEN", "IN_REVIEW", "WAITING_ON_USER", "WAITING_ON_STAFF", "RESOLVED", "REJECTED"];

export function AdminTicketsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "";
  const search = params.get("search") || "";
  const priority = params.get("priority") || "";
  const problemType = params.get("problemType") || "";
  const author = params.get("author") || "";
  const sort = params.get("sort") || "updatedAt";
  const dateField = params.get("dateField") || "createdAt";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Number(params.get("page") || "1");
  const huntId = params.get("huntId") || "";
  const creatureId = params.get("creatureId") || "";
  const authorId = params.get("authorId") || "";
  const [draft, setDraft] = useState(search);
  const [authorDraft, setAuthorDraft] = useState(author);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAdminTickets>>["summary"]>();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getAdminTickets>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = STATUSES.includes(view) ? view : "";
      const assignee = view === "me" || view === "unassigned" ? view : "";
      const result = await getAdminTickets({
        page,
        search,
        status,
        assignee,
        priority,
        problemType,
        author,
        sort,
        dateField,
        from: from ? new Date(from).toISOString() : "",
        to: to ? new Date(to).toISOString() : "",
        huntId,
        creatureId,
        authorId,
      });
      setRows(result.items);
      setSummary(result.summary);
      setTotal(result.total);
      setLimit(result.limit);
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [author, authorId, creatureId, dateField, from, huntId, page, priority, problemType, search, sort, to, view]);

  useEffect(() => {
    void load();
  }, [load]);

  function setView(next: string) {
    const copy = new URLSearchParams(params);
    if (next) copy.set("view", next);
    else copy.delete("view");
    copy.delete("page");
    setParams(copy);
  }

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Central de chamados</h1>
          <p className="admin-page__lead">
            Gerencie solicitações, acompanhe contribuições e organize o atendimento da comunidade.
          </p>
        </div>
      </header>
      {summary ? (
        <div className="support-metrics support-metrics--admin" aria-label="Indicadores da fila">
          {[
            { label: "Total de chamados", value: summary.total ?? 0 },
            { label: "Não atribuídos", value: summary.unassigned ?? 0 },
            { label: "Abertos", value: summary.statuses.OPEN ?? 0 },
            { label: "Em atendimento", value: summary.statuses.IN_REVIEW ?? 0 },
            { label: "Aguardando usuário", value: summary.statuses.WAITING_ON_USER ?? 0 },
            { label: "Aguardando equipe", value: summary.statuses.WAITING_ON_STAFF ?? 0 },
            { label: "Resolvidos", value: summary.statuses.RESOLVED ?? 0 },
          ].map((item) => (
            <div className="support-metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {huntId || creatureId || authorId ? (
        <p className="admin-note">
          Lista restrita à entidade selecionada.{" "}
          <button
            onClick={() => {
              const copy = new URLSearchParams(params);
              copy.delete("huntId");
              copy.delete("creatureId");
              copy.delete("authorId");
              copy.delete("page");
              setParams(copy);
            }}
            type="button"
          >
            Limpar filtro da entidade
          </button>
        </p>
      ) : null}
      <div className="support-tabs" role="tablist" aria-label="Filtrar por situação">
        {VIEWS.map((item) => {
          const count =
            item.id === "unassigned"
              ? summary?.unassigned
              : item.id && summary?.statuses[item.id];
          return (
            <button
              aria-pressed={view === item.id}
              className={view === item.id ? "is-active" : ""}
              key={item.label}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
              {typeof count === "number" ? <em>{count}</em> : null}
            </button>
          );
        })}
      </div>
      <div className="admin-filters support-filters">
        <form
          className="support-filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const copy = new URLSearchParams(params);
            if (draft.trim()) copy.set("search", draft.trim());
            else copy.delete("search");
            if (authorDraft.trim()) copy.set("author", authorDraft.trim());
            else copy.delete("author");
            copy.delete("page");
            setParams(copy);
          }}
        >
          <label>
            Protocolo ou texto
            <input onChange={(event) => setDraft(event.target.value)} value={draft} />
          </label>
          <label>
            Autor
            <input onChange={(event) => setAuthorDraft(event.target.value)} value={authorDraft} />
          </label>
          <label>
            Categoria
            <select
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                if (event.target.value) copy.set("problemType", event.target.value);
                else copy.delete("problemType");
                copy.delete("page");
                setParams(copy);
              }}
              value={problemType}
            >
              <option value="">Todas</option>
              <option value="XP_PER_HOUR">XP/h</option>
              <option value="PROFIT">Lucro/h</option>
              <option value="HUNT_OUTDATED">Hunt desatualizada</option>
              <option value="BESTIARY">Bestiário</option>
              <option value="DIFFICULTY">Dificuldade</option>
              <option value="INCORRECT_INFO">Informação incorreta</option>
              <option value="OTHER">Geral</option>
              <option value="CHARM_GUIDE">{TICKET_CATEGORY_LABEL.CHARM_GUIDE}</option>
            </select>
          </label>
          <label>
            Prioridade
            <select
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                if (event.target.value) copy.set("priority", event.target.value);
                else copy.delete("priority");
                copy.delete("page");
                setParams(copy);
              }}
              value={priority}
            >
              <option value="">Todas</option>
              <option value="LOW">Baixa</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
          <label>
            Ordenar
            <select
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                copy.set("sort", event.target.value);
                copy.delete("page");
                setParams(copy);
              }}
              value={sort}
            >
              <option value="updatedAt">Última atualização</option>
              <option value="createdAt">Abertura</option>
              <option value="priority">Prioridade</option>
            </select>
          </label>
          <label>
            Data
            <select
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                copy.set("dateField", event.target.value);
                copy.delete("page");
                setParams(copy);
              }}
              value={dateField}
            >
              <option value="createdAt">Abertura</option>
              <option value="updatedAt">Atualização</option>
            </select>
          </label>
          <label>
            De
            <input
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                if (event.target.value) copy.set("from", event.target.value);
                else copy.delete("from");
                copy.delete("page");
                setParams(copy);
              }}
              type="datetime-local"
              value={from}
            />
          </label>
          <label>
            Até
            <input
              onChange={(event) => {
                const copy = new URLSearchParams(params);
                if (event.target.value) copy.set("to", event.target.value);
                else copy.delete("to");
                copy.delete("page");
                setParams(copy);
              }}
              type="datetime-local"
              value={to}
            />
          </label>
          <div className="support-filter-actions">
            <Button size="sm" type="submit">Filtrar</Button>
            <Button
              onClick={() => {
                setDraft("");
                setAuthorDraft("");
                setParams(new URLSearchParams());
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Limpar filtros
            </Button>
          </div>
        </form>
      </div>
      <AdminState empty={!loading && rows.length === 0} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Assunto</th>
                <th>Tipo</th>
                <th>Solicitante</th>
                <th>Responsável</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Última atualização</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/tickets/${row.id}`}>{row.protocol}</Link>
                  </td>
                  <td>{row.subject}</td>
                  <td>{ticketCategoryLabel(row.problemType)}</td>
                  <td>{row.author.name || "Jogador"}</td>
                  <td>{row.assignee?.name || "Não atribuído"}</td>
                  <td>
                    <span className={`support-badge support-badge--priority-${row.priority.toLowerCase()}`}>
                      {ticketPriorityLabel(row.priority)}
                    </span>
                  </td>
                  <td>
                    <span className={`support-badge support-badge--${row.status.toLowerCase()}`}>
                      {ticketStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{formatAdminDate(row.updatedAt)}</td>
                  <td>
                    <Link className="button button--secondary button--sm" to={`/admin/tickets/${row.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          limit={limit}
          onPage={(next) => {
            const copy = new URLSearchParams(params);
            copy.set("page", String(next));
            setParams(copy);
          }}
          page={page}
          total={total}
        />
      </AdminState>
    </>
  );
}
