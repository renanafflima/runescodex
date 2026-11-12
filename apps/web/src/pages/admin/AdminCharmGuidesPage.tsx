import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CHARM_GUIDE_DIFFICULTY_LABEL,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
} from "../../domain/charm-guides";
import { describeApiError } from "../../services/api/errors";
import {
  getAdminCharmGuide,
  listAdminCharmGuides,
  moderateAdminCharmGuide,
  type CharmGuideCard,
  type CharmGuideDetail,
  type CharmGuideStatus,
} from "../../services/api/charm-guides";
import { AdminState, formatAdminDate } from "./admin-ui";

const STATUS_FILTERS: Array<{ value: CharmGuideStatus | ""; label: string }> = [
  { value: "PENDING_REVIEW", label: "Aguardando análise" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "CHANGES_REQUESTED", label: "Ajustes solicitados" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "", label: "Pendentes (padrão)" },
];

export function AdminCharmGuidesPage() {
  const [params] = useSearchParams();
  const guideFromUrl = params.get("guide") || "";
  const [status, setStatus] = useState<CharmGuideStatus | "">("PENDING_REVIEW");
  const [items, setItems] = useState<CharmGuideCard[]>([]);
  const [selected, setSelected] = useState<CharmGuideDetail | null>(null);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listAdminCharmGuides(status || undefined);
      setItems(rows);
    } catch (caught) {
      setItems([]);
      setError(describeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openGuide = useCallback(async (id: string) => {
    setPending(true);
    setError("");
    try {
      const detail = await getAdminCharmGuide(id);
      setSelected(detail);
      setResponse(detail.adminResponse || "");
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    if (guideFromUrl) void openGuide(guideFromUrl);
  }, [guideFromUrl, openGuide]);

  async function moderate(next: "PUBLISHED" | "REJECTED" | "CHANGES_REQUESTED") {
    if (!selected) return;
    setPending(true);
    setNotice("");
    setError("");
    try {
      await moderateAdminCharmGuide(selected.id, {
        status: next,
        adminResponse: response.trim() || undefined,
      });
      setNotice(
        next === "PUBLISHED"
          ? "Guia aprovado e publicado."
          : next === "REJECTED"
            ? "Guia rejeitado."
            : "Ajustes solicitados ao autor.",
      );
      setSelected(null);
      await load();
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminState error={error && items.length === 0 ? error : ""} loading={loading} onRetry={() => void load()}>
      <header className="admin-page__head">
        <div>
          <h1>Guias de Charm Points</h1>
          <p className="admin-page__lead">Moderação de publicações do Bestiário.</p>
        </div>
      </header>

      <div className="chip-row" aria-label="Filtrar status">
        {STATUS_FILTERS.map((item) => (
          <button
            className={status === item.value ? "chip active" : "chip"}
            key={item.label}
            onClick={() => setStatus(item.value)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <div className="admin-split">
        <section className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoria</th>
                  <th>Autor</th>
                  <th>CP</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button onClick={() => void openGuide(item.id)} type="button">
                        {item.title}
                      </button>
                    </td>
                    <td>
                      {charmGuideCategoryPoints(item.cpCategory)} ·{" "}
                      {charmGuideCategoryLabel(item.cpCategory)}
                    </td>
                    <td>{item.author.name}</td>
                    <td>{item.totalCharmPoints}</td>
                    <td>{item.status}</td>
                    <td>{formatAdminDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-panel">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <p>
                {selected.author.name} · {charmGuideCategoryPoints(selected.cpCategory)} CP ·{" "}
                {CHARM_GUIDE_DIFFICULTY_LABEL[selected.difficulty]} · {selected.status}
              </p>
              <p>{selected.description}</p>
              <p>
                {selected.stepCount} etapas · {selected.uniqueCreatureCount} criaturas ·{" "}
                {selected.totalCharmPoints} CP únicos
              </p>
              {selected.ticket ? (
                <p>
                  Chamado:{" "}
                  <Link to={`/admin/tickets/${selected.ticket.id}`}>{selected.ticket.protocol}</Link> (
                  {selected.ticket.status})
                </p>
              ) : null}
              <p>
                {selected.status === "PUBLISHED" ? (
                  <Link to={`/bestiary/guides/${selected.id}`}>Abrir visão pública →</Link>
                ) : (
                  <span>Visão pública disponível após a publicação.</span>
                )}
              </p>
              <ol>
                {selected.steps.map((step) => (
                  <li key={step.id}>
                    <strong>
                      Etapa {step.position}
                      {step.hunt ? ` — ${step.hunt.name}` : step.title ? ` — ${step.title}` : ""}
                    </strong>
                    <ul>
                      {step.creatures.map((creature) => (
                        <li key={`${step.id}-${creature.id}`}>
                          {creature.name} ·{" "}
                          {creature.charmPoints != null ? `${creature.charmPoints} CP` : "CP n/d"}
                          {creature.repeatedFromEarlierStep ? " (já contada)" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <label className="field">
                <span className="field__label">Resposta ao autor</span>
                <textarea
                  onChange={(event) => setResponse(event.target.value)}
                  rows={4}
                  value={response}
                />
              </label>
              {selected.status === "PENDING_REVIEW" ? (
                <div className="admin-actions">
                  <button disabled={pending} onClick={() => void moderate("PUBLISHED")} type="button">
                    Aprovar
                  </button>
                  <button
                    disabled={pending || response.trim().length < 3}
                    onClick={() => void moderate("CHANGES_REQUESTED")}
                    type="button"
                  >
                    Solicitar ajustes
                  </button>
                  <button
                    disabled={pending || response.trim().length < 3}
                    onClick={() => void moderate("REJECTED")}
                    type="button"
                  >
                    Rejeitar
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>Selecione um guia para analisar.</p>
          )}
        </section>
      </div>
    </AdminState>
  );
}
