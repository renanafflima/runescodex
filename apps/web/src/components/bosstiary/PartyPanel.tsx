import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/FormControls";
import { useLatestRequest } from "../../hooks/useLatestRequest";
import { describeApiError } from "../../services/api/errors";
import { listBosstiaryProgressRotations } from "../../services/api/bosstiary-progress";
import {
  acceptPartyInvite,
  archiveParty,
  cancelHuntSession,
  cancelPartyInvite,
  completeHuntSession,
  createHuntSession,
  createParty,
  declinePartyInvite,
  getParty,
  invitePartyMember,
  leaveParty,
  listHuntSessions,
  listMyParties,
  listPartyActivities,
  listPartyNotifications,
  listReceivedPartyInvites,
  listSentPartyInvites,
  markPartyNotificationRead,
  removePartyMember,
  startHuntSession,
  transferPartyLeader,
  type AppNotification,
  type HuntSession,
  type PartyInvitation,
  type PartySummary,
} from "../../services/api/parties";

type Screen = "home" | "detail" | "session";

export function PartyPanel() {
  const requests = useLatestRequest();
  const [screen, setScreen] = useState<Screen>("home");
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [received, setReceived] = useState<PartyInvitation[]>([]);
  const [sent, setSent] = useState<PartyInvitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [party, setParty] = useState<PartySummary | null>(null);
  const [sessions, setSessions] = useState<HuntSession[]>([]);
  const [session, setSession] = useState<HuntSession | null>(null);
  const [shared, setShared] = useState<Array<{ id: string; bossName: string; kind: string; itemName?: string | null; visibility: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [rotationId, setRotationId] = useState("");
  const [rotations, setRotations] = useState<Array<{ id: string; title: string }>>([]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [nextLeaderId, setNextLeaderId] = useState("");

  const loadHome = useCallback(async () => {
    const current = requests.start();
    setLoading(true);
    setError("");
    try {
      const [mine, inbox, outbox, inboxNotes] = await Promise.allSettled([
        listMyParties(),
        listReceivedPartyInvites(),
        listSentPartyInvites(),
        listPartyNotifications(),
      ]);
      if (!current()) return;
      if (mine.status === "fulfilled") setParties(mine.value.items);
      if (inbox.status === "fulfilled") setReceived(inbox.value.items);
      if (outbox.status === "fulfilled") setSent(outbox.value.items);
      if (inboxNotes.status === "fulfilled") setNotifications(inboxNotes.value.items);
      const failed = [mine, inbox, outbox, inboxNotes].find((item) => item.status === "rejected");
      if (failed?.status === "rejected") {
        setError(describeApiError(failed.reason));
      }
    } catch (err) {
      if (!current()) return;
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [requests]);

  async function openParty(id: string) {
    setLoading(true);
    setError("");
    try {
      const [detail, nextSessions, nextRotations] = await Promise.all([
        getParty(id),
        listHuntSessions(id),
        listBosstiaryProgressRotations(),
      ]);
      setParty(detail);
      setSessions(nextSessions.items);
      setRotations(nextRotations);
      setScreen("detail");
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function openSession(current: HuntSession) {
    if (!party) return;
    const [fresh, activities] = await Promise.all([
      listHuntSessions(party.id),
      listPartyActivities(party.id, current.id),
    ]);
    const found = fresh.items.find((item) => item.id === current.id) ?? current;
    setSessions(fresh.items);
    setSession(found);
    setShared(activities.items as typeof shared);
    setScreen("session");
  }

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice("");
    try {
      const created = await createParty({ name, description: description || undefined });
      setName("");
      setDescription("");
      await openParty(created.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    if (!party) return;
    setPending(true);
    try {
      await invitePartyMember(party.id, inviteEmail);
      setInviteEmail("");
      setNotice("Convite enviado. Se o e-mail ainda não tiver conta, o convite fica pendente até o cadastro.");
      await openParty(party.id);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!party) return;
    setPending(true);
    try {
      const created = await createHuntSession(party.id, {
        title: sessionTitle,
        rotationId: rotationId || undefined,
        participantIds: party.members.map((member) => member.userId),
      });
      setSessionTitle("");
      await openSession(created);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPending(false);
    }
  }

  const canManage = party?.myRole === "LEADER" || party?.myRole === "OFFICER";

  return (
    <section className="bosstiary-progress">
      <header className="bosstiary-section-title">
        <div>
          <h2>Minhas Partys</h2>
          <p>Reúna jogadores, convide por e-mail e registre hunts compartilhadas sem misturar o diário privado.</p>
        </div>
        <span className="subtle">Comunidade</span>
      </header>

      {error ? <CatalogError description={error} onRetry={() => void (screen === "home" ? loadHome() : party ? openParty(party.id) : loadHome())} /> : null}
      {notice ? <p className="subtle">{notice}</p> : null}

      {screen === "home" ? (
        <>
          {loading && parties.length === 0 ? <CatalogLoading label="Carregando parties" /> : null}
          <div className="bosstiary-progress-mine">
            <section className="bosstiary-progress-panel">
              <header className="bosstiary-progress-panel__head">
                <div>
                  <h3>Criar Party</h3>
                  <p>O criador se torna o líder inicial.</p>
                </div>
              </header>
              <form className="bosstiary-progress-form" onSubmit={onCreate}>
                <Input label="Nome" onChange={(event) => setName(event.target.value)} required value={name} />
                <Textarea label="Descrição" onChange={(event) => setDescription(event.target.value)} rows={3} value={description} />
                <Button disabled={pending} type="submit">Criar Party</Button>
              </form>
            </section>
            <section className="bosstiary-progress-panel">
              <header className="bosstiary-progress-panel__head">
                <div>
                  <h3>Convites recebidos</h3>
                </div>
              </header>
              {received.length === 0 ? (
                <CatalogEmpty description="Quando alguém te convidar, o convite aparece aqui para aceitar ou recusar." title="Nenhum convite pendente" />
              ) : (
                <ul className="bosstiary-activity-list">
                  {received.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.partyName}</strong>
                        <p>Expira em {new Date(item.expiresAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="bosstiary-community-card__actions">
                        <Button onClick={() => void acceptPartyInvite(item.id).then((next) => openParty(next.id))} size="sm" type="button">Aceitar</Button>
                        <Button onClick={() => void declinePartyInvite(item.id).then(() => loadHome())} size="sm" type="button" variant="ghost">Recusar</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bosstiary-progress-panel bosstiary-progress-panel--wide">
              <header className="bosstiary-progress-panel__head">
                <div>
                  <h3>Suas parties</h3>
                </div>
              </header>
              {parties.length === 0 ? (
                <CatalogEmpty description="Crie a primeira party e convide amigos pelo e-mail da conta RuneCodex." title="Nenhuma party ainda" />
              ) : (
                <ul className="bosstiary-drops-grid">
                  {parties.map((item) => (
                    <li key={item.id}>
                      <button className="bosstiary-community-card__title" onClick={() => void openParty(item.id)} type="button">
                        {item.name}
                      </button>
                      <p>
                        {item.memberCount} integrantes · {item.myRole}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bosstiary-progress-panel bosstiary-progress-panel--wide">
              <header className="bosstiary-progress-panel__head">
                <div>
                  <h3>Notificações</h3>
                </div>
              </header>
              {notifications.length === 0 ? (
                <p className="subtle">Nenhuma notificação de party.</p>
              ) : (
                <ul className="bosstiary-activity-list">
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                      {item.readAt ? null : (
                        <Button
                          onClick={() => void markPartyNotificationRead(item.id).then(() => loadHome())}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Marcar como lida
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bosstiary-progress-panel bosstiary-progress-panel--wide">
              <header className="bosstiary-progress-panel__head">
                <div>
                  <h3>Convites enviados</h3>
                </div>
              </header>
                  {sent.length === 0 ? <p className="subtle">Nenhum convite enviado.</p> : (
                <ul className="bosstiary-activity-list">
                  {sent.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.email}</strong>
                        <p>
                          {item.partyName} · {item.status}
                          {item.awaitingAccount ? " · aguardando cadastro" : ""}
                        </p>
                      </div>
                      {item.status === "PENDING" ? (
                        <Button
                          onClick={() => void cancelPartyInvite(item.partyId, item.id).then(() => loadHome())}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      {screen === "detail" && party ? (
        <div className="bosstiary-progress-mine">
          <section className="bosstiary-progress-panel">
            <header className="bosstiary-progress-panel__head">
              <div>
                <h3>{party.name}</h3>
                <p>{party.description || "Sem descrição."}</p>
              </div>
              <Button onClick={() => { setScreen("home"); void loadHome(); }} size="sm" type="button" variant="ghost">Voltar</Button>
            </header>
            <ul className="bosstiary-check-list">
              {party.members.map((member) => (
                <li key={member.id}>
                  <span className="bosstiary-community-card__avatar">{member.avatar}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <p>
                      {member.role} · {[member.vocation, member.level].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  {canManage && member.role !== "LEADER" && member.userId !== party.createdById ? (
                    <Button onClick={() => void removePartyMember(party.id, member.userId).then(() => openParty(party.id))} size="sm" type="button" variant="ghost">
                      Remover
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <form className="bosstiary-progress-form" onSubmit={onInvite}>
                <Input label="Convidar jogador (e-mail)" onChange={(event) => setInviteEmail(event.target.value)} type="email" value={inviteEmail} />
                <Button disabled={pending} type="submit">Convidar jogador</Button>
              </form>
            ) : null}
            {party.myRole === "LEADER" ? (
              <form
                className="bosstiary-progress-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!nextLeaderId) return;
                  void transferPartyLeader(party.id, nextLeaderId).then((next) => {
                    setNextLeaderId("");
                    setParty(next);
                  });
                }}
              >
                <Select
                  label="Transferir liderança"
                  onChange={(event) => setNextLeaderId(event.target.value)}
                  options={[
                    { value: "", label: "Escolher integrante" },
                    ...party.members
                      .filter((member) => member.role !== "LEADER")
                      .map((member) => ({ value: member.userId, label: member.name })),
                  ]}
                  value={nextLeaderId}
                />
                <Button disabled={pending || !nextLeaderId} type="submit">
                  Transferir
                </Button>
              </form>
            ) : null}
            <div className="bosstiary-community-card__actions">
              {party.myRole !== "LEADER" ? (
                <Button onClick={() => void leaveParty(party.id).then(() => { setScreen("home"); void loadHome(); })} type="button" variant="ghost">Sair da Party</Button>
              ) : (
                <Button onClick={() => void archiveParty(party.id).then(() => { setScreen("home"); void loadHome(); })} type="button" variant="ghost">Encerrar Party</Button>
              )}
            </div>
          </section>
          <section className="bosstiary-progress-panel">
            <header className="bosstiary-progress-panel__head">
              <div>
                <h3>Sessões de Hunt</h3>
                <p>Cada sessão guarda o próprio histórico de kills e drops compartilhados.</p>
              </div>
            </header>
            {canManage ? (
              <form className="bosstiary-progress-form" onSubmit={onCreateSession}>
                <Input label="Título da sessão" onChange={(event) => setSessionTitle(event.target.value)} required value={sessionTitle} />
                <Select
                  label="Rotação (opcional)"
                  onChange={(event) => setRotationId(event.target.value)}
                  options={[
                    { value: "", label: "Sem rotação" },
                    ...rotations.map((item) => ({ value: item.id, label: item.title })),
                  ]}
                  value={rotationId}
                />
                <Button disabled={pending} type="submit">Criar sessão</Button>
              </form>
            ) : null}
            {sessions.length === 0 ? (
              <CatalogEmpty description="O líder pode criar uma sessão a partir de uma rotação da comunidade." title="Nenhuma sessão" />
            ) : (
              <ul className="bosstiary-activity-list">
                {sessions.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        {item.status} · {item.rotationTitle || "Sem rotação"}
                      </p>
                    </div>
                    <Button onClick={() => void openSession(item)} size="sm" type="button" variant="ghost">Abrir</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {screen === "session" && party && session ? (
        <section className="bosstiary-progress-panel">
          <header className="bosstiary-progress-panel__head">
            <div>
              <h3>{session.title}</h3>
              <p>
                {session.status} · {session.rotationTitle || "Sem rotação"}
                {session.rotationRemoved ? " (publicação original removida, título preservado)" : ""}
              </p>
            </div>
            <Button onClick={() => void openParty(party.id)} size="sm" type="button" variant="ghost">Voltar</Button>
          </header>
          {canManage && session.status === "PLANNED" ? (
            <Button onClick={() => void startHuntSession(party.id, session.id).then(setSession)} type="button">Iniciar sessão</Button>
          ) : null}
          {canManage && (session.status === "PLANNED" || session.status === "ACTIVE") ? (
            <Button onClick={() => void completeHuntSession(party.id, session.id).then(setSession)} type="button" variant="secondary">Finalizar sessão</Button>
          ) : null}
          {canManage && session.status !== "COMPLETED" && session.status !== "CANCELLED" ? (
            <Button onClick={() => void cancelHuntSession(party.id, session.id).then(setSession)} type="button" variant="ghost">Cancelar sessão</Button>
          ) : null}
          <h4>Participantes</h4>
          <ul className="bosstiary-activity-list">
            {session.participants.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{[item.vocation, item.level].filter(Boolean).join(" ")}</p>
                </div>
              </li>
            ))}
          </ul>
          <h4>Registros compartilhados</h4>
          <p className="subtle">Declarações dos jogadores. O Tibia não confirma automaticamente estes drops. Privados de outros integrantes não aparecem.</p>
          {shared.length === 0 ? (
            <CatalogEmpty description="No Meu Progresso, associe um registro a esta sessão com visibilidade Grupo." title="Nenhum registro compartilhado" />
          ) : (
            <ul className="bosstiary-activity-list">
              {shared.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.kind === "DROP" ? row.itemName : row.bossName}</strong>
                    <p>
                      {row.bossName} · {row.visibility}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  );
}
