import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, describeApiError } from "../services/api/errors";
import {
  listAdminHuntUpdateRequests,
  updateAdminHuntUpdateRequest,
  type AdminHuntUpdateRequest,
  type AdminHuntUpdateRequestPage,
} from "../services/api/admin-hunt-update-requests";
import type { HuntUpdateRequestStatus, HuntUpdateRequestType } from "../services/api/hunt-update-requests";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PageContainer } from "../components/layout/PageContainer";

const TYPE_LABEL: Record<HuntUpdateRequestType, string> = {
  XP: "XP/h",
  PROFIT: "Profit/h",
  LEVEL: "Level recomendado",
  VOCATION: "Vocação",
  CREATURES: "Criaturas",
  LOCATION: "Localização",
  LOOT: "Loot",
  OTHER: "Outra informação",
};

const STATUS_LABEL: Record<HuntUpdateRequestStatus, string> = {
  OPEN: "Em aberto",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
};

const STATUS_TONE = {
  OPEN: "gold",
  IN_REVIEW: "info",
  RESOLVED: "success",
  REJECTED: "neutral",
} as const;

type PendingAction = "resolve" | "reject" | null;

function adminError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") return describeApiError(error);
    if (error.status === 401) return "Entre com uma conta de administrador.";
    if (error.status === 403) return "Você não tem permissão para ver estas solicitações.";
    if (error.status === 404) return error.message || "Solicitação não encontrada.";
    if (error.status === 400) return error.message || "Não foi possível salvar a solicitação.";
    if (error.status >= 500) return "Não foi possível concluir esta ação.";
    return error.message || "Não foi possível concluir esta ação.";
  }
  return describeApiError(error);
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function AdminHuntUpdateRequestsPage() {
  const [page, setPage] = useState<AdminHuntUpdateRequestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<HuntUpdateRequestStatus | "">("");
  const [type, setType] = useState<HuntUpdateRequestType | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<AdminHuntUpdateRequest | null>(null);
  const [response, setResponse] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<PendingAction>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await listAdminHuntUpdateRequests({
        page: currentPage,
        status,
        type,
        search: appliedSearch,
      });
      setPage(next);
      setSelected((current) => next.items.find((item) => item.id === current?.id) ?? current);
    } catch (caught) {
      setPage(null);
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, currentPage, status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  function openRequest(request: AdminHuntUpdateRequest) {
    setSelected(request);
    setResponse(request.adminResponse ?? "");
    setConfirming(null);
    setNotice("");
  }

  async function save(nextStatus: HuntUpdateRequestStatus) {
    if (!selected) return;
    const text = response.trim();
    setPending(true);
    setNotice("");
    try {
      const updated = await updateAdminHuntUpdateRequest(selected.id, {
        status: nextStatus,
        ...(text ? { adminResponse: text } : {}),
      });
      setSelected(updated);
      setResponse(updated.adminResponse ?? "");
      setConfirming(null);
      setNotice("Solicitação atualizada.");
      await load();
    } catch (caught) {
      setNotice(adminError(caught));
    } finally {
      setPending(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setCurrentPage(1);
    setAppliedSearch(search.trim());
  }

  const items = page?.items ?? [];
  const closed = selected?.status === "RESOLVED" || selected?.status === "REJECTED";

  return (
    <PageContainer className="admin-requests" size="wide">
      <header className="admin-requests__head">
        <h1>Solicitações de atualização</h1>
      </header>

      <form className="admin-requests__filters" onSubmit={submitSearch}>
        <label>
          Status
          <select
            onChange={(event) => {
              setCurrentPage(1);
              setStatus(event.target.value as HuntUpdateRequestStatus | "");
            }}
            value={status}
          >
            <option value="">Todos os status</option>
            <option value="OPEN">Em aberto</option>
            <option value="IN_REVIEW">Em análise</option>
            <option value="RESOLVED">Resolvida</option>
            <option value="REJECTED">Rejeitada</option>
          </select>
        </label>
        <label>
          Tipo
          <select
            onChange={(event) => {
              setCurrentPage(1);
              setType(event.target.value as HuntUpdateRequestType | "");
            }}
            value={type}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Busca
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar Hunt..."
            value={search}
          />
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {notice ? (
        <p className="admin-requests__notice" role={notice === "Solicitação atualizada." ? "status" : "alert"}>
          {notice}
        </p>
      ) : null}

      {loading ? (
        <CatalogLoading label="Carregando solicitações" />
      ) : error ? (
        <CatalogError description={error} onRetry={() => void load()} title="Não foi possível carregar as solicitações" />
      ) : items.length === 0 ? (
        <p className="admin-requests__empty">Nenhuma solicitação.</p>
      ) : (
        <div className="admin-requests__table-wrap">
          <table className="admin-requests__table">
            <thead>
              <tr>
                <th>Hunt</th>
                <th>Tipo</th>
                <th>Usuário</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((request) => (
                <tr key={request.id}>
                  <td>{request.hunt.name}</td>
                  <td>{TYPE_LABEL[request.type]}</td>
                  <td>{request.user.name || "Jogador"}</td>
                  <td>
                    <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                  </td>
                  <td>{formatWhen(request.createdAt)}</td>
                  <td>
                    <Button onClick={() => openRequest(request)} type="button" variant="ghost">
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page && page.total > page.limit ? (
        <div className="admin-requests__pager">
          {Array.from({ length: Math.ceil(page.total / page.limit) }, (_, index) => index + 1).map((number) => (
            <Button
              disabled={number === page.page || loading}
              key={number}
              onClick={() => setCurrentPage(number)}
              type="button"
              variant={number === page.page ? "primary" : "ghost"}
            >
              {number}
            </Button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <Modal
          onClose={() => {
            if (!pending) setSelected(null);
          }}
          open
          title={selected.hunt.name}
        >
          <div className="admin-requests__detail">
            <p>
              <strong>Usuário:</strong> {selected.user.name || "Jogador"}
            </p>
            <p>
              <strong>Tipo:</strong> {TYPE_LABEL[selected.type]}
            </p>
            <p>
              <strong>Status:</strong> {STATUS_LABEL[selected.status]}
            </p>
            <p>
              <strong>Descrição:</strong> {selected.description}
            </p>
            <p>
              <strong>Criado em:</strong> {formatWhen(selected.createdAt)}
            </p>
            <p>
              <strong>Atualizado em:</strong> {formatWhen(selected.updatedAt)}
            </p>
            <p>
              <strong>Resolvido em:</strong> {formatWhen(selected.resolvedAt)}
            </p>
            {closed ? (
              <p>
                <strong>Resposta administrativa:</strong> {selected.adminResponse || "—"}
              </p>
            ) : (
              <label htmlFor="admin-hunt-response">
                Escreva uma resposta para o usuário...
                <textarea
                  id="admin-hunt-response"
                  maxLength={1000}
                  onChange={(event) => setResponse(event.target.value)}
                  value={response}
                />
              </label>
            )}
            {confirming ? (
              <div className="admin-requests__confirm">
                <p>
                  {confirming === "reject"
                    ? "Tem certeza que deseja rejeitar esta solicitação?"
                    : "Tem certeza que deseja resolver esta solicitação?"}
                </p>
                <Button
                  disabled={pending}
                  loading={pending}
                  onClick={() => void save(confirming === "reject" ? "REJECTED" : "RESOLVED")}
                  type="button"
                >
                  Confirmar
                </Button>
                <Button disabled={pending} onClick={() => setConfirming(null)} type="button" variant="ghost">
                  Cancelar
                </Button>
              </div>
            ) : closed ? (
              <p>{STATUS_LABEL[selected.status]}</p>
            ) : (
              <div className="admin-requests__actions">
                {selected.status === "OPEN" ? (
                  <Button disabled={pending} loading={pending} onClick={() => void save("IN_REVIEW")} type="button">
                    Colocar em análise
                  </Button>
                ) : null}
                {selected.status === "IN_REVIEW" ? (
                  <Button disabled={pending} onClick={() => setConfirming("resolve")} type="button">
                    Resolver
                  </Button>
                ) : null}
                <Button disabled={pending} onClick={() => setConfirming("reject")} type="button" variant="danger">
                  Rejeitar
                </Button>
              </div>
            )}
          </div>
        </Modal>
      ) : null}
    </PageContainer>
  );
}
