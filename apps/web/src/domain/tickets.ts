export const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberto",
  IN_REVIEW: "Em atendimento",
  WAITING_ON_USER: "Aguardando sua resposta",
  WAITING_ON_STAFF: "Aguardando a equipe",
  RESOLVED: "Resolvido",
  REJECTED: "Rejeitado",
};

export const WAITING_ON_TEAM_FILTER = "waitingOnTeam";

export const TICKET_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  XP_PER_HOUR: "XP por hora",
  PROFIT: "Lucro",
  HUNT_OUTDATED: "Hunt desatualizada",
  BESTIARY: "Bestiário",
  DIFFICULTY: "Dificuldade",
  INCORRECT_INFO: "Informação incorreta",
  OTHER: "Outros",
  CHARM_GUIDE: "Guia de Charm Points",
};

export const CHARM_GUIDE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Aguardando análise",
  PUBLISHED: "Publicado",
  REJECTED: "Rejeitado",
  CHANGES_REQUESTED: "Ajustes solicitados",
  ARCHIVED: "Arquivado",
};

export const TICKET_CREATE_CATEGORIES = [
  { value: "OTHER", label: "Dúvida, acesso, recompensa, sugestão ou erro geral" },
  { value: "INCORRECT_INFO", label: "Informação incorreta" },
] as const;

const CLOSED = new Set(["RESOLVED", "REJECTED"]);

export function ticketStatusLabel(status: string) {
  return TICKET_STATUS_LABEL[status] || status;
}

export function ticketCategoryLabel(problemType: string) {
  return TICKET_CATEGORY_LABEL[problemType] || problemType;
}

export function ticketPriorityLabel(priority: string) {
  return TICKET_PRIORITY_LABEL[priority] || priority;
}

export function charmGuideStatusLabel(status: string) {
  return CHARM_GUIDE_STATUS_LABEL[status] || status;
}

export function ticketCanReply(status: string) {
  return !CLOSED.has(status);
}

export function ticketSubject(description: string, problemType: string) {
  const [first, ...rest] = description.split(/\n\n/);
  const line = first?.trim() ?? "";
  if (rest.length > 0 && line) return line;
  return ticketCategoryLabel(problemType);
}

export function ticketBody(description: string) {
  const parts = description.split(/\n\n/);
  if (parts.length > 1) return parts.slice(1).join("\n\n").trim();
  return description.trim();
}

export function formatProfileDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
