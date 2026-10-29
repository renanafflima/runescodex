import { apiRequest, withQuery } from "./client";
import type { PageResult } from "./page";

export type TicketMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null };
};

export type TicketEvidence = {
  id: string;
  mimeType: string;
  byteSize: number | null;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  protocol: string | null;
  status: string;
  problemType: string;
  impact: string;
  origin: string;
  description: string;
  authorId: string;
  resolutionNote: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
  evidences?: TicketEvidence[];
};

export type TicketListQuery = {
  page?: number;
  status?: string;
  problemType?: string;
};

const EVIDENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const TICKET_EVIDENCE_MAX_BYTES = 5_000_000;

export function listMyTickets(query: TicketListQuery = {}) {
  return apiRequest<PageResult<SupportTicket>>(
    withQuery("/tickets", {
      mine: "true",
      page: query.page ?? 1,
      limit: 20,
      status: query.status,
      problemType: query.problemType,
    }),
    { auth: true },
  );
}

export function getMyTicket(id: string) {
  return apiRequest<SupportTicket>(`/tickets/${id}`, { auth: true });
}

export function createMyTicket(input: {
  problemType: string;
  subject: string;
  description: string;
}) {
  return apiRequest<SupportTicket>("/tickets", {
    method: "POST",
    auth: true,
    json: {
      problemType: input.problemType,
      impact: "MEDIUM",
      origin: "GENERAL",
      subject: input.subject.trim(),
      description: input.description.trim(),
    },
  });
}

export function replyMyTicket(id: string, body: string) {
  return apiRequest<SupportTicket>(`/tickets/${id}/messages`, {
    method: "POST",
    auth: true,
    json: { body },
  });
}

export function evidenceFileError(file: File) {
  if (!EVIDENCE_TYPES.has(file.type)) return "Envie uma imagem JPEG, PNG ou WebP.";
  if (file.size > TICKET_EVIDENCE_MAX_BYTES) return "A imagem passa de 5 MB.";
  return "";
}

export function addTicketEvidence(ticketId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("source", "DEVICE");
  return apiRequest<TicketEvidence>(`/tickets/${ticketId}/evidence`, {
    method: "POST",
    auth: true,
    form,
  });
}
