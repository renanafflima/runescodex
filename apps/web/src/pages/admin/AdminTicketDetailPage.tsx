import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import {
  CHARM_GUIDE_DIFFICULTY_LABEL,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
} from "../../domain/charm-guides";
import {
  charmGuideStatusLabel,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "../../domain/tickets";
import {
  getAdminCharmGuide,
  moderateAdminCharmGuide,
  type CharmGuideCpCategory,
  type CharmGuideDetail,
  type CharmGuideDifficulty,
  type CharmGuideStep,
} from "../../services/api/charm-guides";
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

const ACTIVE_STATUSES = new Set(["OPEN", "IN_REVIEW", "WAITING_ON_USER", "WAITING_ON_STAFF"]);

export function AdminTicketDetailPage() {
  const { id = "" } = useParams();
  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [guide, setGuide] = useState<CharmGuideDetail | null>(null);
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
      if (nextTicket.charmGuide?.id) {
        setGuide(await getAdminCharmGuide(nextTicket.charmGuide.id));
      } else {
        setGuide(null);
      }
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

  const pendingGuide = ticket?.charmGuide?.status === "PENDING_REVIEW";

  return (
    <AdminState error={error && !ticket ? error : ""} loading={loading} onRetry={() => void load()}>
      {ticket ? (
        <>
          <header className="admin-page__head">
            <div>
              <p className="admin-page__lead">
                <Link to="/admin/tickets">Voltar à central</Link>
              </p>
              <h1>{ticket.protocol}</h1>
              <p className="admin-page__lead">
                {ticketSubjectLine(ticket)} · {ticketStatusLabel(ticket.status)} · {ticketPriorityLabel(ticket.priority)} · aberto em{" "}
                {formatAdminDate(ticket.createdAt)}
                {ticket.assignee?.name ? ` · responsável ${ticket.assignee.name}` : " · sem responsável"}
              </p>
            </div>
          </header>
          {notice ? <p role="status">{notice}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          <div className="admin-split support-desk">
            <section className="admin-panel">
              <h2>Descrição</h2>
              <p>{ticket.description}</p>
              <p>{ticketCategoryLabel(ticket.problemType)}</p>
              {ticket.problemType === "CHARM_GUIDE" && ticket.charmGuide ? null : ticket.catalogValue || ticket.userValue ? (
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
                    <Button
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
                      variant="secondary"
                    >
                      Aplicar valor sugerido
                    </Button>
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
              {ticket.charmGuide ? (
                <div className="support-contribution">
                  <h2>Contribuição vinculada</h2>
                  <p>
                    {ticket.charmGuide.title} · {charmGuideCategoryPoints(ticket.charmGuide.cpCategory as CharmGuideCpCategory)} CP ·{" "}
                    {charmGuideStatusLabel(ticket.charmGuide.status)} · {ticket.charmGuide.totalCharmPoints} CP únicos ·{" "}
                    {ticket.charmGuide.stepCount} etapas
                  </p>
                  <p>
                    Autor: {contributionAuthor(ticket)} · enviado em{" "}
                    {formatAdminDate(ticket.charmGuide.createdAt)}
                  </p>
                  {guide ? (
                    <>
                      <p>
                        {CHARM_GUIDE_DIFFICULTY_LABEL[guide.difficulty as CharmGuideDifficulty] || guide.difficulty} ·{" "}
                        {charmGuideCategoryLabel(guide.cpCategory)}
                      </p>
                      <p>{guide.description}</p>
                      <ol>
                        {guide.steps.map((step) => (
                          <li key={step.id}>
                            <strong>{guideStepHeading(step)}</strong>
                            <ul>
                              {step.creatures.map((creature) => (
                                <li key={`${step.id}-${creature.id}`}>
                                  {creature.name}
                                  {creature.charmPoints != null ? ` · ${creature.charmPoints} CP` : ""}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : null}
                  <p className="admin-note">
                    Aprovar publica o guia no Bestiário e encerra este chamado. Resolver o chamado sem aprovar a
                    contribuição não publica os dados.
                  </p>
                  {ticket.charmGuide.status === "PUBLISHED" ? (
                    <p>
                      <Link to={`/bestiary/guides/${ticket.charmGuide.id}`}>Abrir guia público →</Link>
                    </p>
                  ) : (
                    <p>
                      <Link to={`/admin/charm-guides?guide=${ticket.charmGuide.id}`}>Abrir na fila de análise →</Link>
                    </p>
                  )}
                  {pendingGuide ? (
                    <div className="admin-actions">
                      <Button
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm("Aprovar e publicar esta contribuição no Bestiário?")) return;
                          void run(
                            () =>
                              moderateAdminCharmGuide(ticket.charmGuide!.id, {
                                status: "PUBLISHED",
                                adminResponse: reason.trim() || "Contribuição aprovada e publicada no Bestiário.",
                              }),
                            "Contribuição aprovada, publicada no Bestiário e chamado resolvido.",
                          );
                        }}
                        type="button"
                      >
                        Aprovar e publicar
                      </Button>
                      <Button
                        disabled={pending || reason.trim().length < 3}
                        onClick={() => {
                          if (!window.confirm("Solicitar ajustes ao autor?")) return;
                          void run(
                            () =>
                              moderateAdminCharmGuide(ticket.charmGuide!.id, {
                                status: "CHANGES_REQUESTED",
                                adminResponse: reason.trim(),
                              }),
                            "Ajustes solicitados. O chamado ficou aguardando o usuário.",
                          );
                        }}
                        type="button"
                        variant="secondary"
                      >
                        Solicitar ajustes
                      </Button>
                      <Button
                        disabled={pending || reason.trim().length < 3}
                        onClick={() => {
                          if (!window.confirm("Rejeitar esta contribuição? Ela não será publicada.")) return;
                          void run(
                            () =>
                              moderateAdminCharmGuide(ticket.charmGuide!.id, {
                                status: "REJECTED",
                                adminResponse: reason.trim(),
                              }),
                            "Contribuição rejeitada e chamado encerrado.",
                          );
                        }}
                        type="button"
                        variant="danger"
                      >
                        Rejeitar contribuição
                      </Button>
                    </div>
                  ) : null}
                </div>
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
                <Button disabled={pending || reply.trim().length === 0} type="submit">
                  Enviar ao usuário
                </Button>
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
                <Button disabled={pending || note.trim().length === 0} type="submit" variant="secondary">
                  Salvar nota
                </Button>
              </form>
              <h2>Evidências</h2>
              {ticket.evidences.length === 0 ? <p className="admin-note">Nenhum anexo.</p> : null}
              <ul>
                {ticket.evidences.map((evidence) => (
                  <li key={evidence.id}>
                    <Button onClick={() => void openTicketEvidence(ticket.id, evidence.id)} type="button" variant="ghost">
                      {evidence.mimeType} · {formatAdminDate(evidence.createdAt)}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
            <aside className="admin-panel support-side">
              <h2>Atendimento</h2>
              <p>Solicitante: {ticket.author.name || "Jogador"}</p>
              <p>Responsável: {ticket.assignee?.name || "Não atribuído"}</p>
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
              <label>
                Nota de resolução, rejeição ou resposta à contribuição
                <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
              </label>
              {pendingGuide ? (
                <p className="admin-note">
                  Este chamado tem uma contribuição aguardando análise. Use Aprovar e publicar ou Rejeitar contribuição.
                  O botão Resolver só encerra o atendimento depois que a contribuição deixar de estar em análise.
                </p>
              ) : null}
              <div className="admin-actions">
                {ticket.status === "OPEN" ? (
                  <Button
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
                  </Button>
                ) : null}
                {ACTIVE_STATUSES.has(ticket.status) ? (
                  <>
                    {ticket.status !== "WAITING_ON_USER" ? (
                      <Button
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
                        variant="secondary"
                      >
                        Aguardar usuário
                      </Button>
                    ) : null}
                    {ticket.status !== "WAITING_ON_STAFF" ? (
                      <Button
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
                        variant="secondary"
                      >
                        Aguardar equipe
                      </Button>
                    ) : null}
                    <Button
                      disabled={pending || reason.trim().length < 3 || pendingGuide}
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
                    </Button>
                    <Button
                      disabled={pending || reason.trim().length < 3 || pendingGuide}
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
                      variant="danger"
                    >
                      Rejeitar
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={pending || reason.trim().length < 3}
                    onClick={() => {
                      if (!window.confirm("Reabrir este chamado?")) return;
                      void run(() => postAdminTicketReopen(ticket.id, reason), "Chamado reaberto.");
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Reabrir
                  </Button>
                )}
              </div>
              {ticket.resolutionNote ? <p>Última nota: {ticket.resolutionNote}</p> : null}
            </aside>
          </div>
        </>
      ) : null}
    </AdminState>
  );
}

function ticketSubjectLine(ticket: AdminTicketDetail) {
  const [first] = ticket.description.split(/\n\n/);
  return first?.trim() || ticketCategoryLabel(ticket.problemType);
}

function contributionAuthor(ticket: AdminTicketDetail) {
  return (
    ticket.charmGuide?.user.activeCharacter?.name ||
    ticket.author.name ||
    "Jogador"
  );
}

function guideStepHeading(step: CharmGuideStep) {
  const ordinal = `Etapa ${step.position}`;
  const extra = step.hunt?.name?.trim() || step.title?.trim() || "";
  if (!extra || extra === ordinal) return ordinal;
  return `${ordinal} — ${extra}`;
}
