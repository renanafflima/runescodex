import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api/errors";
import type { HuntUpdateRequest, HuntUpdateRequestPage } from "../../services/api/hunt-update-requests";
import { HuntUpdateRequests } from "./HuntUpdateRequests";

const api = vi.hoisted(() => ({
  listHuntUpdateRequests: vi.fn(),
  createHuntUpdateRequest: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../../services/api/hunt-update-requests", () => api);

function request(status: HuntUpdateRequest["status"], id: string = status): HuntUpdateRequest {
  return {
    id,
    type: status === "OPEN" ? "XP" : "PROFIT",
    description: `Descrição ${status}`,
    status,
    adminResponse: status === "REJECTED" ? "Fora do escopo." : null,
    createdAt: "2026-10-05T12:00:00.000Z",
    updatedAt: "2026-10-05T12:00:00.000Z",
    resolvedAt: null,
  };
}

function page(items: HuntUpdateRequest[]): HuntUpdateRequestPage {
  return { items, page: 1, limit: 50, total: items.length, hasMore: false };
}

function renderSection() {
  return render(
    <MemoryRouter>
      <HuntUpdateRequests slug="cyclops" />
    </MemoryRouter>,
  );
}

describe("HuntUpdateRequests", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    auth.isAuthenticated = false;
    api.listHuntUpdateRequests.mockResolvedValue(page([]));
    api.createHuntUpdateRequest.mockResolvedValue(request("OPEN", "new"));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks a logged-out visitor to sign in and does not open the form", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Encontrou alguma informação desatualizada?" })).toBeInTheDocument();
    expect(screen.getByText("Ajude a manter o RuneCodex atualizado.")).toBeInTheDocument();
    expect(screen.getByText("Entre na sua conta para solicitar uma atualização.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar atualização" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar solicitação" })).not.toBeInTheDocument();
    expect(api.listHuntUpdateRequests).not.toHaveBeenCalled();
  });

  it("shows the logged-in button, history statuses, and an API error", async () => {
    auth.isAuthenticated = true;
    api.listHuntUpdateRequests.mockResolvedValueOnce(
      page([request("OPEN", "a"), request("IN_REVIEW", "b"), request("RESOLVED", "c"), request("REJECTED", "d")]),
    );
    const view = renderSection();

    expect(await screen.findByRole("button", { name: "Solicitar atualização" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Minhas solicitações" })).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText("Resolvida")).toBeInTheDocument();
    expect(screen.getByText("Rejeitada")).toBeInTheDocument();
    expect(screen.getByText("Descrição OPEN")).toBeInTheDocument();
    expect(screen.getByText("Fora do escopo.")).toBeInTheDocument();

    api.listHuntUpdateRequests.mockRejectedValueOnce(new ApiError("HTTP_ERROR", 500, "Internal server error", null));
    view.rerender(
      <MemoryRouter>
        <HuntUpdateRequests slug="other" />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Não foi possível concluir esta ação.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma solicitação.")).not.toBeInTheDocument();
  });

  it("shows a loading state while the history is requested", () => {
    auth.isAuthenticated = true;
    api.listHuntUpdateRequests.mockImplementation(() => new Promise(() => undefined));
    renderSection();

    expect(screen.getByText("Carregando solicitações")).toBeInTheDocument();
  });

  it("shows an empty history", async () => {
    auth.isAuthenticated = true;
    renderSection();

    expect(await screen.findByText("Nenhuma solicitação.")).toBeInTheDocument();
  });

  it("opens the form, sends the selected type, and shows success", async () => {
    auth.isAuthenticated = true;
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Solicitar atualização" }));
    expect(screen.getByRole("heading", { name: "Solicitar atualização" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("O que está desatualizado?"), { target: { value: "LOOT" } });
    fireEvent.change(screen.getByLabelText("Descreva o que precisa ser atualizado"), {
      target: { value: "O loot principal mudou." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    await waitFor(() =>
      expect(api.createHuntUpdateRequest).toHaveBeenCalledWith("cyclops", "LOOT", "O loot principal mudou."),
    );
    expect(await screen.findByText("Solicitação enviada com sucesso.")).toBeInTheDocument();
  });

  it("shows a duplicate-request error from the API", async () => {
    auth.isAuthenticated = true;
    api.createHuntUpdateRequest.mockRejectedValueOnce(
      new ApiError("HTTP_ERROR", 409, "Você já tem uma solicitação em aberto deste tipo para esta hunt.", null),
    );
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Solicitar atualização" }));
    fireEvent.change(screen.getByLabelText("Descreva o que precisa ser atualizado"), {
      target: { value: "O XP dessa hunt está desatualizado." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(
      await screen.findByText("Você já tem uma solicitação em aberto deste tipo para esta hunt."),
    ).toBeInTheDocument();
  });

  it("disables the submit button while the request is being sent", async () => {
    auth.isAuthenticated = true;
    let release: () => void = () => undefined;
    api.createHuntUpdateRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(request("OPEN", "new"));
        }),
    );
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Solicitar atualização" }));
    fireEvent.change(screen.getByLabelText("Descreva o que precisa ser atualizado"), {
      target: { value: "O XP dessa hunt está desatualizado." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Enviar solicitação/ })).toBeDisabled());
    release();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar solicitação" })).not.toBeInTheDocument());
  });
});
