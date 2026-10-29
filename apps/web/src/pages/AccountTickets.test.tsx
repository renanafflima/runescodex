import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { AccountTickets } from "./AccountTickets";

const api = vi.hoisted(() => ({
  listMyTickets: vi.fn(),
  getMyTicket: vi.fn(),
  createMyTicket: vi.fn(),
  replyMyTicket: vi.fn(),
  addTicketEvidence: vi.fn(),
  evidenceFileError: vi.fn(() => ""),
}));

vi.mock("../services/api/tickets", () => api);

const ticket = {
  id: "ticket-1",
  protocol: "RC-1",
  status: "OPEN",
  problemType: "OTHER",
  impact: "MEDIUM",
  origin: "GENERAL",
  description: "Falha no acesso\n\nA sessão cai ao abrir o perfil.",
  authorId: "user-1",
  resolutionNote: null,
  firstResponseAt: "2026-10-21T12:00:00.000Z",
  createdAt: "2026-10-20T12:00:00.000Z",
  updatedAt: "2026-10-21T12:00:00.000Z",
  messages: [
    {
      id: "msg-1",
      body: "Pode tentar novamente.",
      createdAt: "2026-10-21T12:00:00.000Z",
      author: { id: "staff-1", name: "Equipe" },
    },
  ],
};

describe("AccountTickets", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists the caller's tickets and opens the detail", async () => {
    api.listMyTickets.mockResolvedValue({ items: [ticket] });
    api.getMyTicket.mockResolvedValue(ticket);
    render(<AccountTickets />);

    expect(await screen.findByText("RC-1")).toBeInTheDocument();
    expect(screen.getByText("Falha no acesso")).toBeInTheDocument();
    expect(screen.getByText("Resposta da equipe")).toBeInTheDocument();
    expect(api.listMyTickets).toHaveBeenCalledWith({ status: "", problemType: "" });

    fireEvent.click(screen.getByRole("button", { name: /RC-1/ }));
    expect(await screen.findByText("Pode tentar novamente.")).toBeInTheDocument();
    expect(screen.getByText("A sessão cai ao abrir o perfil.")).toBeInTheDocument();
  });

  it("shows an error and an empty state", async () => {
    api.listMyTickets.mockRejectedValueOnce(new ApiError("HTTP_ERROR", 500, "falhou", null));
    render(<AccountTickets />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Erro tempor.rio no servidor/);

    cleanup();
    api.listMyTickets.mockResolvedValue({ items: [] });
    render(<AccountTickets />);
    expect(await screen.findByText("Nenhum chamado")).toBeInTheDocument();
  });

  it("validates the form and keeps the draft when the request fails", async () => {
    api.listMyTickets.mockResolvedValue({ items: [] });
    api.createMyTicket.mockRejectedValue(new ApiError("HTTP_ERROR", 400, "Assunto inválido", null));
    render(<AccountTickets />);
    const openTicket = screen.getAllByRole("button", { name: "Abrir chamado" })[0];
    if (!openTicket) throw new Error("Botão de abertura ausente");
    fireEvent.click(openTicket);

    fireEvent.submit(document.getElementById("ticket-form") as HTMLFormElement);
    expect(await screen.findByRole("alert")).toHaveTextContent(/assunto/i);
    expect(api.createMyTicket).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "Acesso" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Não entra na conta." } });
    fireEvent.submit(document.getElementById("ticket-form") as HTMLFormElement);
    expect(await screen.findByRole("alert")).toHaveTextContent("Assunto inválido");
    expect(screen.getByLabelText("Assunto")).toHaveValue("Acesso");
    expect(api.createMyTicket).toHaveBeenCalledTimes(1);
  });

  it("ignores a repeated submit while the first one is still running", async () => {
    api.listMyTickets.mockResolvedValue({ items: [] });
    let resolveCreate: (value: typeof ticket) => void = () => undefined;
    api.createMyTicket.mockImplementation(
      () => new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<AccountTickets />);
    const openTicket = screen.getAllByRole("button", { name: "Abrir chamado" })[0];
    if (!openTicket) throw new Error("Botão de abertura ausente");
    fireEvent.click(openTicket);
    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "Acesso" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Não entra na conta." } });
    const form = document.getElementById("ticket-form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.createMyTicket).toHaveBeenCalledTimes(1);
    resolveCreate(ticket);
    expect(await screen.findByText(/RC-1 aberto/)).toBeInTheDocument();
  });

  it("sends a reply and blocks another user's ticket in the detail", async () => {
    api.listMyTickets.mockResolvedValue({ items: [ticket] });
    api.getMyTicket.mockResolvedValue(ticket);
    api.replyMyTicket.mockResolvedValue({
      ...ticket,
      messages: [
        ...ticket.messages,
        {
          id: "msg-2",
          body: "Continua igual.",
          createdAt: "2026-10-22T12:00:00.000Z",
          author: { id: "user-1", name: null },
        },
      ],
    });
    render(<AccountTickets />);
    fireEvent.click(await screen.findByRole("button", { name: /RC-1/ }));
    fireEvent.change(await screen.findByLabelText("Sua resposta"), { target: { value: "Continua igual." } });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    expect(await screen.findByText("Resposta registrada.")).toBeInTheDocument();
    expect(api.replyMyTicket).toHaveBeenCalledWith("ticket-1", "Continua igual.");

    cleanup();
    api.listMyTickets.mockResolvedValue({ items: [ticket] });
    api.getMyTicket.mockRejectedValue(new ApiError("HTTP_ERROR", 403, "Sem permissão", null));
    render(<AccountTickets />);
    fireEvent.click(await screen.findByRole("button", { name: /RC-1/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
