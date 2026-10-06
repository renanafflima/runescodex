import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError, describeApiError } from "../../services/api/errors";
import {
  createHuntUpdateRequest,
  listHuntUpdateRequests,
  type HuntUpdateRequest,
  type HuntUpdateRequestPage,
  type HuntUpdateRequestStatus,
  type HuntUpdateRequestType,
} from "../../services/api/hunt-update-requests";
import { CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const TYPE_OPTIONS: Array<{ value: HuntUpdateRequestType; label: string }> = [
  { value: "XP", label: "XP/h" },
  { value: "PROFIT", label: "Profit/h" },
  { value: "LEVEL", label: "Level recomendado" },
  { value: "VOCATION", label: "Vocação" },
  { value: "CREATURES", label: "Criaturas" },
  { value: "LOCATION", label: "Localização" },
  { value: "LOOT", label: "Loot" },
  { value: "OTHER", label: "Outra informação" },
];

const STATUS_LABEL: Record<HuntUpdateRequestStatus, string> = {
  OPEN: "Enviada",
  IN_REVIEW: "Em análise",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
};

type HuntUpdateRequestsProps = {
  slug: string;
};

function requestError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") return describeApiError(error);
    if (error.status === 401) return "Entre na sua conta para solicitar uma atualização.";
    if (error.status === 403) return "Você não pode ver esta solicitação.";
    if (error.status === 404) return error.message || "Hunt ou solicitação não encontrada.";
    if (error.status === 409) {
      return error.message || "Você já tem uma solicitação em aberto deste tipo para esta hunt.";
    }
    if (error.status === 400 || error.status === 422) return error.message || "Solicitação inválida.";
    if (error.status >= 500) return "Não foi possível concluir esta ação.";
    return error.message || "Não foi possível concluir esta ação.";
  }
  return describeApiError(error);
}

function typeLabel(type: HuntUpdateRequestType) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function HuntUpdateRequests({ slug }: HuntUpdateRequestsProps) {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState<HuntUpdateRequestPage | null>(null);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<HuntUpdateRequestType>("XP");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPage(await listHuntUpdateRequests(slug));
    } catch (caught) {
      setPage(null);
      setError(requestError(caught));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPage(null);
      setLoading(false);
      setError("");
      return;
    }
    void load();
  }, [isAuthenticated, load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = description.trim();
    if (text.length < 5) {
      setNotice("Descreva a atualização com pelo menos 5 caracteres.");
      return;
    }
    setPending(true);
    setNotice("");
    try {
      await createHuntUpdateRequest(slug, type, text);
      setDescription("");
      setOpen(false);
      setNotice("Solicitação enviada com sucesso.");
      await load();
    } catch (caught) {
      setNotice(requestError(caught));
    } finally {
      setPending(false);
    }
  }

  const items = page?.items ?? [];

  return (
    <section aria-labelledby="hunt-update-title" className="hunt-update">
      <div className="hunt-update__intro">
        <h2 id="hunt-update-title">Encontrou alguma informação desatualizada?</h2>
        <p>Ajude a manter o RuneCodex atualizado.</p>
      </div>

      {isAuthenticated ? (
        <Button disabled={pending} onClick={() => setOpen(true)} type="button" variant="secondary">
          Solicitar atualização
        </Button>
      ) : (
        <p className="hunt-update__login">
          Entre na sua conta para solicitar uma atualização. <Link to="/login">Entrar</Link>
        </p>
      )}

      {notice ? (
        <p className="hunt-update__notice" role={notice === "Solicitação enviada com sucesso." ? "status" : "alert"}>
          {notice}
        </p>
      ) : null}

      {open ? (
        <Modal
          description="Ajude a manter o RuneCodex atualizado."
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          open
          title="Solicitar atualização"
        >
          <form className="hunt-update__form" onSubmit={submit}>
            <label htmlFor="hunt-update-type">O que está desatualizado?</label>
            <select
              className="field__control"
              id="hunt-update-type"
              onChange={(event) => setType(event.target.value as HuntUpdateRequestType)}
              value={type}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="hunt-update-description">Descreva o que precisa ser atualizado</label>
            <textarea
              className="field__control hunt-update__input"
              id="hunt-update-description"
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <Button disabled={pending} loading={pending} type="submit">
              Enviar solicitação
            </Button>
          </form>
        </Modal>
      ) : null}

      {isAuthenticated ? (
        <div className="hunt-update__history">
          <h3>Minhas solicitações</h3>
          {loading ? (
            <CatalogLoading label="Carregando solicitações" />
          ) : error ? (
            <CatalogError description={error} onRetry={() => void load()} title="Não foi possível carregar as solicitações" />
          ) : items.length === 0 ? (
            <p className="hunt-update__empty">Nenhuma solicitação.</p>
          ) : (
            <ol className="hunt-update__list">
              {items.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}

function RequestCard({ request }: { request: HuntUpdateRequest }) {
  return (
    <li className="hunt-update__card">
      <div className="hunt-update__meta">
        <strong>{typeLabel(request.type)}</strong>
        <span>{STATUS_LABEL[request.status]}</span>
      </div>
      <p>{request.description}</p>
      {request.adminResponse ? <p className="hunt-update__response">{request.adminResponse}</p> : null}
    </li>
  );
}
