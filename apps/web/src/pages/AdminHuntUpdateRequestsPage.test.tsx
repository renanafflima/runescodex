import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import type { AdminHuntUpdateRequest, AdminHuntUpdateRequestPage } from "../services/api/admin-hunt-update-requests";
import { AdminHuntUpdateRequestsPage } from "./AdminHuntUpdateRequestsPage";

const api = vi.hoisted(() => ({
  listAdminHuntUpdateRequests: vi.fn(),
  updateAdminHuntUpdateRequest: vi.fn(),
}));

vi.mock("../services/api/admin-hunt-update-requests", () => api);

function request(overrides: Partial<AdminHuntUpdateRequest> = {}): AdminHuntUpdateRequest {
  return {
    id: "request-1",
    type: "XP",
    description: "O XP dessa hunt está desatualizado.",
    status: "OPEN",
    adminResponse: null,
    createdAt: "2026-10-05T12:00:00.000Z",
    updatedAt: "2026-10-05T12:00:00.000Z",
    resolvedAt: null,
    hunt: { id: "hunt-1", name: "Orc Fortress", slug: "orc-fortress" },
    user: { id: "user-1", name: "Renan" },
    ...overrides,
  };
}

function page(items: AdminHuntUpdateRequest[], pageNumber = 1, total = items.length): AdminHuntUpdateRequestPage {
  return { items, page: pageNumber, limit: 20, total, hasMore: pageNumber * 20 < total };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminHuntUpdateRequestsPage />
    </MemoryRouter>,
  );
}

describe("AdminHuntUpdateRequestsPage", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    api.listAdminHuntUpdateRequests.mockResolvedValue(page([request()]));
    api.updateAdminHuntUpdateRequest.mockImplementation((_id: string, body: { status: string; adminResponse?: string }) =>
      Promise.resolve(request({ status: body.status as AdminHuntUpdateRequest["status"], adminResponse: body.adminResponse ?? null })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a loading state and then the request list", async () => {
    let release: (value: AdminHuntUpdateRequestPage) => void = () => undefined;
    api.listAdminHuntUpdateRequests.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    renderPage();

    expect(screen.getByText("Carregando solicitações")).toBeInTheDocument();
    release(
      page([
        request(),
        request({
          id: "request-2",
          status: "IN_REVIEW",
          type: "PROFIT",
          hunt: { id: "hunt-2", name: "Banuta", slug: "banuta" },
        }),
      ]),
    );
    expect(await screen.findByText("Orc Fortress")).toBeInTheDocument();
    expect(screen.getByText("Banuta")).toBeInTheDocument();
    expect(screen.getAllByText("Em aberto").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Em análise").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Renan").length).toBeGreaterThan(0);
  });

  it("shows an empty list and an API error without the empty copy", async () => {
    api.listAdminHuntUpdateRequests.mockResolvedValueOnce(page([]));
    renderPage();
    expect(await screen.findByText("Nenhuma solicitação.")).toBeInTheDocument();

    api.listAdminHuntUpdateRequests.mockRejectedValueOnce(new ApiError("HTTP_ERROR", 403, "Admin access required", null));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "OPEN" } });
    expect(await screen.findByText("Você não tem permissão para ver estas solicitações.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma solicitação.")).not.toBeInTheDocument();
  });

  it("filters by status and search and moves between pages", async () => {
    api.listAdminHuntUpdateRequests.mockResolvedValue(page([request()], 1, 40));
    renderPage();
    expect(await screen.findByText("Orc Fortress")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "OPEN" } });
    await waitFor(() =>
      expect(api.listAdminHuntUpdateRequests).toHaveBeenCalledWith(
        expect.objectContaining({ status: "OPEN", page: 1 }),
      ),
    );

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "LOOT" } });
    await waitFor(() =>
      expect(api.listAdminHuntUpdateRequests).toHaveBeenCalledWith(expect.objectContaining({ type: "LOOT" })),
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar Hunt..."), { target: { value: "orc" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() =>
      expect(api.listAdminHuntUpdateRequests).toHaveBeenCalledWith(expect.objectContaining({ search: "orc" })),
    );

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() =>
      expect(api.listAdminHuntUpdateRequests).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it("moves a request to review, then resolves it after confirmation", async () => {
    api.listAdminHuntUpdateRequests.mockResolvedValue(page([request({ status: "IN_REVIEW" })]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    expect(screen.getByText("O XP dessa hunt está desatualizado.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Escreva uma resposta para o usuário..."), {
      target: { value: "XP atualizado." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolver" }));
    expect(screen.getByText("Tem certeza que deseja resolver esta solicitação?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(api.updateAdminHuntUpdateRequest).toHaveBeenCalledWith("request-1", {
        status: "RESOLVED",
        adminResponse: "XP atualizado.",
      }),
    );
    expect(await screen.findByText("Solicitação atualizada.")).toBeInTheDocument();
    expect(api.listAdminHuntUpdateRequests.mock.calls.length).toBeGreaterThan(1);
  });

  it("asks for confirmation before rejecting", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect(screen.getByText("Tem certeza que deseja rejeitar esta solicitação?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Tem certeza que deseja rejeitar esta solicitação?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(api.updateAdminHuntUpdateRequest).toHaveBeenCalledWith("request-1", { status: "REJECTED" }),
    );
  });

  it("puts an open request in review without confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    fireEvent.click(screen.getByRole("button", { name: "Colocar em análise" }));
    await waitFor(() =>
      expect(api.updateAdminHuntUpdateRequest).toHaveBeenCalledWith("request-1", { status: "IN_REVIEW" }),
    );
    expect(screen.queryByText(/Tem certeza/)).not.toBeInTheDocument();
  });

  it("shows closed requests as resolved or rejected", async () => {
    api.listAdminHuntUpdateRequests.mockResolvedValue(
      page([
        request({ id: "done", status: "RESOLVED", adminResponse: "XP atualizado." }),
        request({ id: "nope", status: "REJECTED", type: "LOOT", adminResponse: "Já estava atualizado." }),
      ]),
    );
    renderPage();
    expect(await screen.findAllByRole("button", { name: "Ver" })).toHaveLength(2);
    expect(screen.getAllByText("Resolvida").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Rejeitada").length).toBeGreaterThan(1);

    const open = screen.getAllByRole("button", { name: "Ver" })[0];
    if (!open) throw new Error("Botão Ver não encontrado");
    fireEvent.click(open);
    expect(screen.getAllByText("XP atualizado.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
  });
});
