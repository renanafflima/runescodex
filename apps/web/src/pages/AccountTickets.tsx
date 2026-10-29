import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CatalogEmpty, CatalogLoading } from "../components/catalog/CatalogState";
import { Section } from "../components/layout/Section";
import { Button } from "../components/ui/Button";
import { Select, Textarea, Input } from "../components/ui/FormControls";
import { Modal } from "../components/ui/Modal";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_CREATE_CATEGORIES,
  TICKET_STATUS_LABEL,
  formatProfileDate,
  ticketBody,
  ticketCanReply,
  ticketCategoryLabel,
  ticketStatusLabel,
  ticketSubject,
} from "../domain/tickets";
import { describeApiError } from "../services/api/errors";
import {
  addTicketEvidence,
  createMyTicket,
  evidenceFileError,
  getMyTicket,
  listMyTickets,
  replyMyTicket,
  type SupportTicket,
} from "../services/api/tickets";

const emptyDraft = {
  problemType: "OTHER",
  subject: "",
  description: "",
};

export function AccountTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [problemType, setProblemType] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replying, setReplying] = useState(false);
  const sendLock = useRef(false);
  const replyLock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await listMyTickets({ status, problemType });
      setTickets(page.items);
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [problemType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setReply("");
    setReplyError("");
    setEvidenceFile(null);
    setEvidenceError("");
    setDetailLoading(true);
    try {
      setDetail(await getMyTicket(id));
    } catch (caught) {
      setDetailError(describeApiError(caught));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendLock.current) return;
    const subject = draft.subject.trim();
    const description = draft.description.trim();
    if (subject.length < 3) {
      setFormError("Informe um assunto com pelo menos 3 caracteres.");
      return;
    }
    if (description.length < 5) {
      setFormError("Descreva o problema com pelo menos 5 caracteres.");
      return;
    }
    if (file) {
      const fileProblem = evidenceFileError(file);
      if (fileProblem) {
        setFormError(fileProblem);
        return;
      }
    }
    sendLock.current = true;
    setSending(true);
    setFormError("");
    try {
      const created = await createMyTicket({
        problemType: draft.problemType,
        subject,
        description,
      });
      let attachmentNote = "";
      if (file) {
        try {
          await addTicketEvidence(created.id, file);
        } catch (caught) {
          attachmentNote = ` O anexo não foi enviado: ${describeApiError(caught)}`;
        }
      }
      setComposerOpen(false);
      setDraft(emptyDraft);
      setFile(null);
      setFileKey((current) => current + 1);
      setNotice(`Chamado ${created.protocol || "registrado"} aberto.${attachmentNote}`);
      await load();
      await openDetail(created.id);
    } catch (caught) {
      setFormError(describeApiError(caught));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !evidenceFile || uploading) return;
    const problem = evidenceFileError(evidenceFile);
    if (problem) {
      setEvidenceError(problem);
      return;
    }
    setUploading(true);
    setEvidenceError("");
    try {
      await addTicketEvidence(detail.id, evidenceFile);
      setEvidenceFile(null);
      setDetail(await getMyTicket(detail.id));
      setNotice("Anexo enviado.");
    } catch (caught) {
      setEvidenceError(describeApiError(caught));
    } finally {
      setUploading(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || replyLock.current) return;
    const body = reply.trim();
    if (body.length < 1) {
      setReplyError("Escreva a mensagem.");
      return;
    }
    replyLock.current = true;
    setReplying(true);
    setReplyError("");
    try {
      const updated = await replyMyTicket(detail.id, body);
      setDetail(updated);
      setReply("");
      setNotice("Resposta registrada.");
      await load();
    } catch (caught) {
      setReplyError(describeApiError(caught));
    } finally {
      replyLock.current = false;
      setReplying(false);
    }
  }

  return (
    <Section
      actions={
        <Button onClick={() => { setComposerOpen(true); setFormError(""); }} size="sm" type="button">
          Abrir chamado
        </Button>
      }
      className="ticket-section"
      description="Erros, acesso, personagens, recompensas e outras situações entram no mesmo sistema de chamados da equipe."
      eyebrow="Suporte"
      title="Meus chamados"
    >
      <div className="ticket-filters">
        <Select
          label="Estado"
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: "", label: "Todos" },
            ...Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => ({ value, label })),
          ]}
          value={status}
        />
        <Select
          label="Categoria"
          onChange={(event) => setProblemType(event.target.value)}
          options={[
            { value: "", label: "Todas" },
            ...Object.entries(TICKET_CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
          ]}
          value={problemType}
        />
      </div>
      {loading ? <CatalogLoading label="Carregando chamados" /> : null}
      {!loading && error ? (
        <div className="device-card" role="alert">
          <p>{error}</p>
          <Button onClick={() => void load()} type="button" variant="secondary">Tentar novamente</Button>
        </div>
      ) : null}
      {!loading && !error && tickets.length === 0 ? (
        <CatalogEmpty
          action={<Button onClick={() => setComposerOpen(true)} type="button">Abrir chamado</Button>}
          description="Nenhum chamado seu corresponde a este filtro."
          title="Nenhum chamado"
        />
      ) : null}
      {!loading && !error && tickets.length > 0 ? (
        <ul className="ticket-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button onClick={() => void openDetail(ticket.id)} type="button">
                <strong>{ticket.protocol || "Chamado"}</strong>
                <span>{ticketSubject(ticket.description, ticket.problemType)}</span>
                <span>{ticketCategoryLabel(ticket.problemType)}</span>
                <span>{ticketStatusLabel(ticket.status)}</span>
                <span>Aberto em {formatProfileDate(ticket.createdAt)}</span>
                <span>Atualizado em {formatProfileDate(ticket.updatedAt)}</span>
                {ticket.firstResponseAt ? <em>Resposta da equipe</em> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      <Modal
        description="O chamado fica vinculado à sua conta. A equipe responde pelo mesmo fluxo."
        footer={
          <>
            <Button onClick={() => setComposerOpen(false)} type="button" variant="ghost">Cancelar</Button>
            <Button disabled={sending} form="ticket-form" loading={sending} type="submit">Enviar</Button>
          </>
        }
        onClose={() => setComposerOpen(false)}
        open={composerOpen}
        title="Abrir chamado"
      >
        <form className="auth-form" id="ticket-form" onSubmit={(event) => void submitTicket(event)}>
          <Select
            label="Categoria"
            onChange={(event) => setDraft((current) => ({ ...current, problemType: event.target.value }))}
            options={TICKET_CREATE_CATEGORIES.map((item) => ({ ...item }))}
            value={draft.problemType}
          />
          <Input
            label="Assunto"
            maxLength={120}
            onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value.replace(/[\r\n]/g, "") }))}
            required
            value={draft.subject}
          />
          <Textarea
            label="Descrição"
            maxLength={4800}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            required
            rows={6}
            value={draft.description}
          />
          <Input
            accept="image/jpeg,image/png,image/webp"
            hint="Opcional. JPEG, PNG ou WebP, até 5 MB."
            key={fileKey}
            label="Anexo"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          {formError ? <p role="alert">{formError}</p> : null}
        </form>
      </Modal>

      <Modal
        description={detail ? ticketCategoryLabel(detail.problemType) : "Consulta do chamado"}
        onClose={closeDetail}
        open={Boolean(selectedId)}
        title={detail ? ticketSubject(detail.description, detail.problemType) : "Chamado"}
      >
        {detailLoading ? <CatalogLoading label="Carregando chamado" /> : null}
        {detailError ? <p role="alert">{detailError}</p> : null}
        {detail ? (
          <div className="ticket-detail">
            <p>{detail.protocol} · {ticketStatusLabel(detail.status)}</p>
            <p>Aberto em {formatProfileDate(detail.createdAt)}</p>
            <p>Atualizado em {formatProfileDate(detail.updatedAt)}</p>
            <h3>Descrição</h3>
            <p>{ticketBody(detail.description)}</p>
            {detail.resolutionNote ? (
              <>
                <h3>Resultado</h3>
                <p>{detail.resolutionNote}</p>
              </>
            ) : null}
            <h3>Anexos</h3>
            <p>{detail.evidences?.length ? `${detail.evidences.length} imagem(ns) no chamado.` : "Nenhum anexo."}</p>
            {ticketCanReply(detail.status) ? (
              <form className="auth-form" onSubmit={(event) => void submitEvidence(event)}>
                <Input
                  accept="image/jpeg,image/png,image/webp"
                  label="Enviar imagem"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                {evidenceError ? <p role="alert">{evidenceError}</p> : null}
                <Button disabled={uploading || !evidenceFile} loading={uploading} type="submit">
                  Enviar anexo
                </Button>
              </form>
            ) : null}
            <h3>Mensagens</h3>
            {detail.messages && detail.messages.length > 0 ? (
              <ol className="ticket-thread">
                {detail.messages.map((message) => (
                  <li key={message.id}>
                    <strong>{message.author.name || (message.author.id === detail.authorId ? "Você" : "Equipe")}</strong>
                    <span>{formatProfileDate(message.createdAt)}</span>
                    <p>{message.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Ainda não há mensagens além da descrição original.</p>
            )}
            {ticketCanReply(detail.status) ? (
              <form className="auth-form" onSubmit={(event) => void submitReply(event)}>
                <Textarea
                  label="Sua resposta"
                  maxLength={5000}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  value={reply}
                />
                {replyError ? <p role="alert">{replyError}</p> : null}
                <Button disabled={replying || reply.trim().length < 1} loading={replying} type="submit">
                  Responder
                </Button>
              </form>
            ) : (
              <p>Este chamado não aceita novas mensagens.</p>
            )}
          </div>
        ) : null}
      </Modal>
    </Section>
  );
}
