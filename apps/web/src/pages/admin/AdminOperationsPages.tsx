import { useCallback, useEffect, useState } from "react";
import {
  getAdminAudit,
  getAdminRedemptions,
  getAdminSettings,
  postAdminRedemption,
  removeAdminSetting,
  saveAdminSetting,
} from "../../services/api/admin-portal";
import { AdminState, Pager, PeriodFilters, adminError, formatAdminDate, useAdminPeriod } from "./admin-ui";

export function AdminRewardsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminRedemptions>> | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminRedemptions());
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "deliver" | "cancel") {
    setPending(id);
    setError("");
    try {
      await postAdminRedemption(id, action, note.trim());
      setNote("");
      await load();
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setPending("");
    }
  }

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Recompensas</h1>
          <p className="admin-page__lead">
            A carteira oficial não é alterada fora do fluxo de resgate. Aprovar de novo um resgate já processado é recusado.
          </p>
        </div>
      </header>
      <AdminState error={error && !data ? error : ""} loading={loading} onRetry={() => void load()}>
        {error ? <p role="alert">{error}</p> : null}
        <p>
          Pendentes {data?.counts.PENDING ?? 0} · aprovados {data?.counts.APPROVED ?? 0} · entregues{" "}
          {data?.counts.DELIVERED ?? 0}
        </p>
        <label>
          Nota da ação
          <textarea onChange={(event) => setNote(event.target.value)} value={note} />
        </label>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reward</th>
                <th>Usuário</th>
                <th>Preço</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.reward?.name || "Reward"}</td>
                  <td>{item.user?.email}</td>
                  <td>
                    {item.price} {item.currency}
                  </td>
                  <td>{item.status}</td>
                  <td>{formatAdminDate(item.createdAt)}</td>
                  <td className="admin-actions">
                    {item.status === "PENDING" ? (
                      <button disabled={pending === item.id} onClick={() => void act(item.id, "approve")} type="button">
                        Aprovar
                      </button>
                    ) : null}
                    {item.status === "APPROVED" ? (
                      <button disabled={pending === item.id} onClick={() => void act(item.id, "deliver")} type="button">
                        Entregar
                      </button>
                    ) : null}
                    {item.status === "PENDING" || item.status === "APPROVED" ? (
                      <button
                        disabled={pending === item.id || note.trim().length < 3}
                        onClick={() => void act(item.id, "cancel")}
                        type="button"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminState>
    </>
  );
}

export function AdminAuditPage() {
  const period = useAdminPeriod();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof getAdminAudit>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!period.ready) {
        setError("Informe o início e o fim do período.");
        setLoading(false);
        return;
      }
      setResult(await getAdminAudit({ ...period.query, page, action, entityType }));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [action, entityType, page, period.query, period.ready]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Auditoria</h1>
          <p className="admin-page__lead">Registro append-only das ações administrativas feitas depois desta implantação.</p>
        </div>
        <PeriodFilters />
      </header>
      <div className="admin-filters">
        <label>
          Ação
          <input onChange={(event) => { setAction(event.target.value); setPage(1); }} value={action} />
        </label>
        <label>
          Entidade
          <input onChange={(event) => { setEntityType(event.target.value); setPage(1); }} placeholder="ticket, hunt_update_request" value={entityType} />
        </label>
      </div>
      <AdminState empty={!result?.items.length} error={error} loading={loading} onRetry={() => void load()}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Resumo</th>
              </tr>
            </thead>
            <tbody>
              {result?.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatAdminDate(item.createdAt)}</td>
                  <td>{item.actor.name || "Staff"}</td>
                  <td>{item.action}</td>
                  <td>{item.entityType}</td>
                  <td>{item.summary}</td>
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

export function AdminSettingsPage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getAdminSettings>>["items"]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await getAdminSettings();
      setItems(next.items);
      setDrafts(Object.fromEntries(next.items.map((item) => [item.key, item.amount === null ? "" : String(item.amount)])));
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Configurações</h1>
          <p className="admin-page__lead">
            Sem um limite salvo, o alerta correspondente não é calculado. Todos os prazos usam tempo corrido.
          </p>
        </div>
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        {notice ? <p role="status">{notice}</p> : null}
        {items.map((item) => (
          <form
            className="admin-panel admin-form"
            key={item.key}
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(drafts[item.key]);
              void saveAdminSetting(item.key, amount)
                .then(async () => {
                  setNotice(`${item.label} salvo.`);
                  await load();
                })
                .catch((caught) => setError(adminError(caught)));
            }}
          >
            <h2>{item.label}</h2>
            <p className="admin-note">{item.definition}</p>
            <label>
              {item.unit} ({item.min}–{item.max})
              <input
                onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
                value={drafts[item.key] || ""}
              />
            </label>
            <div className="admin-actions">
              <button type="submit">Salvar</button>
              <button
                onClick={() => {
                  void removeAdminSetting(item.key)
                    .then(async () => {
                      setNotice(`${item.label} removido.`);
                      await load();
                    })
                    .catch((caught) => setError(adminError(caught)));
                }}
                type="button"
              >
                Remover limite
              </button>
            </div>
          </form>
        ))}
      </AdminState>
    </>
  );
}

export function AdminAccessPage() {
  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Acesso</h1>
          <p className="admin-page__lead">
            O RuneCodex autentica com dois papéis: USER e ADMIN. Toda rota deste portal exige ADMIN no servidor.
          </p>
        </div>
      </header>
      <section className="admin-panel">
        <h2>O que a API valida</h2>
        <p>Esconder um menu não autoriza ninguém. O AdminGuard consulta o papel gravado na conta a cada requisição.</p>
        <p>USER não abre o portal, mesmo que conheça o endereço.</p>
        <p>ADMIN vê operação, conteúdo, comunidade, atendimento, licenças e configurações.</p>
      </section>
      <section className="admin-panel">
        <h2>O que não é um papel de login</h2>
        <p>
          Colaborador, parceria, criador de conteúdo e compensação classificam uma concessão de licença. Não entram na autenticação.
        </p>
        <p>
          Papéis separados de financeiro, suporte ou moderação não foram criados. Eles exigiriam trocar o papel das contas ADMIN atuais e um segundo sistema de permissão.
        </p>
      </section>
    </>
  );
}
