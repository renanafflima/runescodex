import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAdminStaff,
  getAdminTicket,
  openTicketEvidence,
  patchAdminTicketAssignment,
  patchAdminTicketPriority,
  patchAdminTicketStatus,
  postAdminTicketApply,
  postAdminTicketMessage,
  postAdminTicketReopen,
  type AdminTicketDetail,
} from "../../services/api/admin-portal";
import { AdminState, adminError, formatAdminDate } from "./admin-ui";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberto",
  IN_REVIEW: "Em atendimento",
  WAITING_ON_USER: "Aguardando usuário",
  WAITING_ON_STAFF: "Aguardando equipe",
  RESOLVED: "Resolvido",
  REJECTED: "Rejeitado",
};

const ACTIVE_STATUSES = new Set(["OPEN", "IN_REVIEW", "WAITING_ON_USER", "WAITING_ON_STAFF"]);

export function AdminTicketDetailPage() {
  const { id = "" } = useParams();
  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string | null }>>([]);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [urgent, setUrgent] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextTicket, nextStaff] = await Promise.all([getAdminTicket(id), getAdminStaff()]);
      setTicket(nextTicket);
      setStaff(nextStaff);
      setUrgent(nextTicket.urgentReason || "");
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(success);
      setReply("");
      setNote("");
      await load();
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminState error={error && !ticket ? error : ""} loading={loading} onRetry={() => void load()}>
      {ticket ? (
        <>
          <header className="admin-page__head">
            <div>
              <p className="admin-page__lead">
                <Link to="/admin/tickets">Chamados</Link>
              </p>
              <h1>{ticket.protocol}</h1>
              <p className="admin-page__lead">
                {STATUS_LABEL[ticket.status] || ticket.status} · {ticket.priority} · aberto em{" "}
                {formatAdminDate(ticket.createdAt)}
              </p>
            </div>
          </header>
          {notice ? <p role="status">{notice}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="admin-split">
            <section className="admin-panel">
              <h2>Descrição</h2>
              <p>{ticket.description}</p>
              <p>
                Tipo {ticket.problemType} · impacto {ticket.impact} · origem {ticket.origin}
              </p>
              {ticket.catalogValue || ticket.userValue ? (
                <p>
                  Valor atual informado: {ticket.catalogValue || "—"} · valor sugerido: {ticket.userValue || "—"}
                </p>
              ) : null}
              {ticket.hunt ? (
                <div>
                  <h2>Hunt relacionada</h2>
                  <p>
                    <Link to={`/hunts/${ticket.hunt.slug}`}>{ticket.hunt.name}</Link> · {ticket.hunt.location}
                    {ticket.hunt.subLocation ? ` · ${ticket.hunt.subLocation}` : ""} · {ticket.hunt.difficulty}
                  </p>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Vocação</th>
                          <th>Level</th>
                          <th>XP/h</th>
                          <th>Lucro/h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticket.hunt.vocations.map((row) => (
                          <tr key={row.vocation}>
                            <td>{row.vocation}</td>
                            <td>
                              {row.levelMin}
                              {row.levelMax ? `–${row.levelMax}` : "+"}
                            </td>
                            <td>{row.xpPerHour}</td>
                            <td>{row.profitPerHour}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="admin-note">
                    Vocações do chamado: {ticket.vocations.join(", ") || "não informadas"}. A aplicação altera só o
                    campo numérico do tipo do chamado, nas vocações que existem na Hunt.
                  </p>
                  {ticket.contentAppliedAt ? (
                    <p>Correção aplicada em {formatAdminDate(ticket.contentAppliedAt)}.</p>
                  ) : (
                    <button
                      disabled={pending || ticket.status === "OPEN" || ticket.status === "REJECTED"}
                      onClick={() => {
                        if (!window.confirm("Aplicar esta correção na Hunt? A mesma correção não será gravada duas vezes.")) {
                          return;
                        }
                        void run(
                          () => postAdminTicketApply(ticket.id, ticket.updatedAt),
                          "Correção aplicada.",
                        );
                      }}
                      type="button"
                    >
                      Aplicar valor sugerido
                    </button>
                  )}
                </div>
              ) : null}
              {ticket.creature ? (
                <p>
                  Criatura: <Link to={`/bestiary/${ticket.creature.slug}`}>{ticket.creature.name}</Link>
                  {ticket.creature.hp !== null ? ` · HP ${ticket.creature.hp}` : ""}
                  {ticket.creature.experience !== null ? ` · XP ${ticket.creature.experience}` : ""}
                </p>
              ) : null}
              <h2>Conversa</h2>
              <div className="admin-thread">
                {ticket.messages.length === 0 ? <p className="admin-note">Nenhuma mensagem ainda.</p> : null}
                {ticket.messages.map((message) => (
                  <article
                    className={`admin-message ${message.visibility === "INTERNAL" ? "admin-message--internal" : ""}`}
                    key={message.id}
                  >
                    <strong>
                      {message.author.name || "Staff"} · {message.visibility === "INTERNAL" ? "Nota interna" : "Pública"}
                    </strong>
                    <p>{message.body}</p>
                    <p className="admin-note">{formatAdminDate(message.createdAt)}</p>
                  </article>
                ))}
              </div>
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () =>
                      postAdminTicketMessage(ticket.id, {
                        visibility: "PUBLIC",
                        body: reply,
                        expectedUpdatedAt: ticket.updatedAt,
                      }),
                    "Resposta enviada.",
                  );
                }}
              >
                <label>
                  Resposta pública
                  <textarea onChange={(event) => setReply(event.target.value)} value={reply} />
                </label>
                <button disabled={pending || reply.trim().length === 0} type="submit">
                  Enviar ao usuário
                </button>
              </form>
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(
                    () =>
                      postAdminTicketMessage(ticket.id, {
                        visibility: "INTERNAL",
                        body: note,
                        expectedUpdatedAt: ticket.updatedAt,
                      }),
                    "Nota interna registrada.",
                  );
                }}
              >
                <label>
                  Nota interna
                  <textarea onChange={(event) => setNote(event.target.value)} value={note} />
                </label>
                <button disabled={pending || note.trim().length === 0} type="submit">
                  Salvar nota
                </button>
              </form>
            </section>
            <aside className="admin-panel">
              <h2>Atendimento</h2>
              <p>Solicitante: {ticket.author.name || "Jogador"}</p>
              <p>Primeira resposta: {formatAdminDate(ticket.firstResponseAt)}</p>
              <p>Nível informado: {ticket.playerLevel ?? "—"}</p>
              <p>Party: {ticket.partyFormat || "—"}</p>
              <label>
                Responsável
                <select
                  onChange={(event) => {
                    const assigneeId = event.target.value || null;
                    void run(
                      () =>
                        patchAdminTicketAssignment(ticket.id, {
                          assigneeId,
                          expectedUpdatedAt: ticket.updatedAt,
                        }),
                      "Responsável atualizado.",
                    );
                  }}
                  value={ticket.assignee?.id || ""}
                >
                  <option value="">Não atribuído</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name || "Administrador"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade
                <select
                  onChange={(event) => {
                    const priority = event.target.value;
                    if (priority === "URGENT" && urgent.trim().length < 10) {
                      setNotice("Escreva a justificativa urgente antes de salvar.");
                      return;
                    }
                    void run(
                      () =>
                        patchAdminTicketPriority(ticket.id, {
                          priority,
                          urgentReason: priority === "URGENT" ? urgent : undefined,
                          expectedUpdatedAt: ticket.updatedAt,
                        }),
                      "Prioridade atualizada.",
                    );
                  }}
                  value={ticket.priority}
                >
                  <option value="LOW">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
              <label>
                Justificativa urgente
                <textarea onChange={(event) => setUrgent(event.target.value)} value={urgent} />
              </label>
              <div className="admin-actions">
                {ticket.status === "OPEN" ? (
                  <button
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () =>
                          patchAdminTicketStatus(ticket.id, {
                            status: "IN_REVIEW",
                            expectedUpdatedAt: ticket.updatedAt,
                          }),
                        "Chamado em atendimento.",
                      )
                    }
                    type="button"
                  >
                    Assumir atendimento
                  </button>
                ) : null}
                {ACTIVE_STATUSES.has(ticket.status) ? (
                  <>
                    {ticket.status !== "WAITING_ON_USER" ? (
                      <button
                        disabled={pending}
                        onClick={() =>
                          void run(
                            () =>
                              patchAdminTicketStatus(ticket.id, {
                                status: "WAITING_ON_USER",
                                expectedUpdatedAt: ticket.updatedAt,
                              }),
                            "Chamado aguardando o usuário.",
                          )
                        }
                        type="button"
                      >
                        Aguardar usuário
                      </button>
                    ) : null}
                    {ticket.status !== "WAITING_ON_STAFF" ? (
                      <button
                        disabled={pending}
                        onClick={() =>
                          void run(
                            () =>
                              patchAdminTicketStatus(ticket.id, {
                                status: "WAITING_ON_STAFF",
                                expectedUpdatedAt: ticket.updatedAt,
                              }),
                            "Chamado aguardando a equipe.",
                          )
                        }
                        type="button"
                      >
                        Aguardar equipe
                      </button>
                    ) : null}
                    <button
                      disabled={pending || reason.trim().length < 3}
                      onClick={() => {
                        if (!window.confirm("Resolver este chamado?")) return;
                        void run(
                          () =>
                            patchAdminTicketStatus(ticket.id, {
                              status: "RESOLVED",
                              resolutionNote: reason,
                              expectedUpdatedAt: ticket.updatedAt,
                            }),
                          "Chamado resolvido.",
                        );
                      }}
                      type="button"
                    >
                      Resolver
                    </button>
                    <button
                      disabled={pending || reason.trim().length < 3}
                      onClick={() => {
                        if (!window.confirm("Rejeitar este chamado?")) return;
                        void run(
                          () =>
                            patchAdminTicketStatus(ticket.id, {
                              status: "REJECTED",
                              resolutionNote: reason,
                              expectedUpdatedAt: ticket.updatedAt,
                            }),
                          "Chamado rejeitado.",
                        );
                      }}
                      type="button"
                    >
                      Rejeitar
                    </button>
                  </>
                ) : (
                  <button
                    disabled={pending || reason.trim().length < 3}
                    onClick={() => {
                      if (!window.confirm("Reabrir este chamado?")) return;
                      void run(() => postAdminTicketReopen(ticket.id, reason), "Chamado reaberto.");
                    }}
                    type="button"
                  >
                    Reabrir
                  </button>
                )}
              </div>
              <label>
                Nota de resolução ou reabertura
                <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
              </label>
              {ticket.resolutionNote ? <p>Última nota: {ticket.resolutionNote}</p> : null}
              <h2>Evidências</h2>
              {ticket.evidences.length === 0 ? <p className="admin-note">Nenhum anexo.</p> : null}
              <ul>
                {ticket.evidences.map((evidence) => (
                  <li key={evidence.id}>
                    <button onClick={() => void openTicketEvidence(ticket.id, evidence.id)} type="button">
                      {evidence.mimeType} · {formatAdminDate(evidence.createdAt)}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      ) : null}
    </AdminState>
  );
}
