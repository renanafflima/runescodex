import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberto",
  IN_REVIEW: "Em atendimento",
  WAITING_ON_USER: "Aguardando usuário",
  WAITING_ON_STAFF: "Aguardando equipe",
  RESOLVED: "Resolvido",
  REJECTED: "Rejeitado",
};

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
            A fila inclui os estados de espera. Notas internas não aparecem para o autor do chamado.
            Correções estruturadas de Hunt ficam em Contribuições.
          </p>
        </div>
      </header>
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
      <div className="admin-filters">
        {VIEWS.map((item) => (
          <button
            aria-pressed={view === item.id}
            key={item.label}
            onClick={() => setView(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <form
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
          <button type="submit">Filtrar</button>
        </form>
      </div>
      {summary ? (
        <p className="admin-note">
          {summary.definition} Abertos {summary.statuses.OPEN ?? 0}, em atendimento {summary.statuses.IN_REVIEW ?? 0},
          aguardando usuário {summary.statuses.WAITING_ON_USER ?? 0}, aguardando equipe {summary.statuses.WAITING_ON_STAFF ?? 0}.
          Na fila ativa: urgente {summary.priorities.URGENT ?? 0}, alta {summary.priorities.HIGH ?? 0}, normal {summary.priorities.NORMAL ?? 0}, baixa {summary.priorities.LOW ?? 0}.
        </p>
      ) : null}
      <AdminState empty={!loading && rows.length === 0} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Assunto</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Solicitante</th>
                <th>Responsável</th>
                <th>Mensagens</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/tickets/${row.id}`}>{row.protocol}</Link>
                  </td>
                  <td>{row.subject}</td>
                  <td>{row.problemType}</td>
                  <td>{STATUS_LABEL[row.status] ?? row.status}</td>
                  <td>{row.priority}</td>
                  <td>{row.author.name || "Jogador"}</td>
                  <td>{row.assignee?.name || "Não atribuído"}</td>
                  <td>{row.messageCount}</td>
                  <td>{formatAdminDate(row.updatedAt)}</td>
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
