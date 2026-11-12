import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTicketsPage } from "./AdminTicketsPage";

const api = vi.hoisted(() => ({
  getAdminTickets: vi.fn(),
}));

vi.mock("../../services/api/admin-portal", async () => {
  const actual = await vi.importActual<typeof import("../../services/api/admin-portal")>(
    "../../services/api/admin-portal",
  );
  return {
    ...actual,
    getAdminTickets: api.getAdminTickets,
  };
});

const page = {
  items: [
    {
      id: "ticket-1",
      protocol: "RC-STAFF",
      status: "WAITING_ON_STAFF",
      priority: "NORMAL",
      problemType: "OTHER",
      origin: "GENERAL",
      subject: "Fila da equipe",
      createdAt: "2026-11-12T12:00:00.000Z",
      updatedAt: "2026-11-12T12:00:00.000Z",
      messageCount: 1,
      author: { id: "user-1", name: "Jogador" },
      assignee: null,
      hunt: null,
      creature: null,
    },
  ],
  page: 1,
  total: 1,
  limit: 20,
  summary: {
    scope: "snapshot" as const,
    definition: "Fila",
    total: 8,
    unassigned: 2,
    statuses: {
      OPEN: 3,
      IN_REVIEW: 1,
      WAITING_ON_STAFF: 1,
      WAITING_ON_USER: 1,
      RESOLVED: 2,
      REJECTED: 0,
    },
    priorities: {},
  },
};

function show(path = "/admin/tickets") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminTicketsPage />
    </MemoryRouter>,
  );
}

describe("AdminTicketsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps WAITING_ON_STAFF as an isolated administrative filter", async () => {
    api.getAdminTickets.mockResolvedValue(page);
    show();

    expect(await screen.findByText("RC-STAFF")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Filtrar por situação" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Aguardando equipe/ }));

    await waitFor(() =>
      expect(api.getAdminTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "WAITING_ON_STAFF",
          assignee: "",
        }),
      ),
    );
  });
});
