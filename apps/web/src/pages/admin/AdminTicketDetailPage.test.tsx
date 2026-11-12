import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTicketDetailPage } from "./AdminTicketDetailPage";

const api = vi.hoisted(() => ({
  getAdminTicket: vi.fn(),
  getAdminStaff: vi.fn(),
  patchAdminTicketStatus: vi.fn(),
  getAdminCharmGuide: vi.fn(),
  moderateAdminCharmGuide: vi.fn(),
}));

vi.mock("../../services/api/admin-portal", async () => {
  const actual = await vi.importActual<typeof import("../../services/api/admin-portal")>(
    "../../services/api/admin-portal",
  );
  return {
    ...actual,
    getAdminTicket: api.getAdminTicket,
    getAdminStaff: api.getAdminStaff,
    patchAdminTicketStatus: api.patchAdminTicketStatus,
  };
});

vi.mock("../../services/api/charm-guides", async () => {
  const actual = await vi.importActual<typeof import("../../services/api/charm-guides")>(
    "../../services/api/charm-guides",
  );
  return {
    ...actual,
    getAdminCharmGuide: api.getAdminCharmGuide,
    moderateAdminCharmGuide: api.moderateAdminCharmGuide,
  };
});

const ticket = {
  id: "ticket-1",
  protocol: "RC-CHARM1",
  status: "OPEN",
  priority: "NORMAL",
  urgentReason: null,
  problemType: "CHARM_GUIDE",
  impact: "MEDIUM",
  origin: "BESTIARY",
  description: "Guia de Charm Points enviado para análise: Trilha dos Gigantes",
  catalogValue: "175",
  userValue: "CP_300",
  playerLevel: null,
  partyFormat: null,
  resolutionNote: null,
  createdAt: "2026-11-12T12:00:00.000Z",
  updatedAt: "2026-11-12T12:00:00.000Z",
  firstResponseAt: null,
  contentAppliedAt: null,
  resolvedAt: null,
  author: { id: "user-1", name: "Jogador" },
  assignee: null,
  vocations: [],
  hunt: null,
  creature: null,
  charmGuide: {
    id: "guide-1",
    title: "Trilha dos Gigantes & Répteis",
    cpCategory: "CP_300",
    status: "PENDING_REVIEW",
    totalCharmPoints: 175,
    uniqueCreatureCount: 8,
    stepCount: 3,
    difficulty: "ADVANCED",
    createdAt: "2026-11-12T12:00:00.000Z",
    publishedAt: null,
    user: { id: "user-1", activeCharacter: { name: "Knight" } },
  },
  evidences: [],
  messages: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/tickets/ticket-1"]}>
      <Routes>
        <Route path="/admin/tickets/:id" element={<AdminTicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminTicketDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not resolve a pending charm guide from Resolver and publishes through the existing moderation API", async () => {
    api.getAdminTicket.mockResolvedValue(ticket);
    api.getAdminStaff.mockResolvedValue([]);
    api.getAdminCharmGuide.mockResolvedValue({
      ...ticket.charmGuide,
      description: "Guia de teste",
      author: { id: "user-1", name: "Knight" },
      steps: [
        {
          id: "step-1",
          position: 1,
          title: "Inicio",
          hunt: null,
          creatures: [{ id: "c1", name: "Giant Spider", charmPoints: 25 }],
        },
      ],
    });
    api.moderateAdminCharmGuide.mockResolvedValue({ status: "PUBLISHED" });

    renderPage();

    expect(await screen.findByText("Contribuição vinculada")).toBeInTheDocument();
    expect(screen.getAllByText(/Trilha dos Gigantes/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Resolver" })).toBeDisabled();

    window.confirm = vi.fn(() => true);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar e publicar" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/publicada no Bestiário/);
    expect(api.moderateAdminCharmGuide).toHaveBeenCalledWith("guide-1", {
      status: "PUBLISHED",
      adminResponse: "Contribuição aprovada e publicada no Bestiário.",
    });
    expect(api.patchAdminTicketStatus).not.toHaveBeenCalled();
  });

  it("uses the ticket author when the contribution has no active character", async () => {
    api.getAdminTicket.mockResolvedValue({
      ...ticket,
      author: { id: "user-1", name: "Jogador" },
      charmGuide: {
        ...ticket.charmGuide,
        user: { id: "user-1", activeCharacter: null },
      },
    });
    api.getAdminStaff.mockResolvedValue([]);
    api.getAdminCharmGuide.mockResolvedValue({
      ...ticket.charmGuide,
      description: "Guia de teste",
      author: { id: "user-1", name: "Jogador" },
      steps: [
        {
          id: "step-1",
          position: 1,
          title: "Etapa 1",
          hunt: null,
          creatures: [{ id: "c1", name: "Giant Spider", charmPoints: 25 }],
        },
      ],
    });

    renderPage();

    expect(await screen.findByText(/Autor: Jogador/)).toBeInTheDocument();
    expect(screen.getByText("Etapa 1")).toBeInTheDocument();
    expect(screen.queryByText("Etapa 1 — Etapa 1")).not.toBeInTheDocument();
  });
});
