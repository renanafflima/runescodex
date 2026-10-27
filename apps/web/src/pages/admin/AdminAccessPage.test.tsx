import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAccessPage } from "./AdminOperationsPages";
import { AdminUserDetailPage } from "./AdminCatalogPages";

const api = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("../../services/api/admin-portal", () => api);

describe("Admin operational surfaces", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains the real USER and ADMIN roles", () => {
    render(
      <MemoryRouter>
        <AdminAccessPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Acesso" })).toBeInTheDocument();
    expect(screen.getByText(/USER e ADMIN/)).toBeInTheDocument();
    expect(screen.getByText(/não foram criados/)).toBeInTheDocument();
  });

  it("shows the account license, payment and tickets", async () => {
    api.getAdminUser.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      role: "USER",
      createdAt: "2026-10-01T00:00:00.000Z",
      character: { name: "Ada", level: 200, vocation: "ED", world: "Antica" },
      wallet: { points: 10, gold: 0, diamond: 0 },
      forumThreads: 1,
      forumReplies: 2,
      contributions: 3,
      tickets: 1,
      openTickets: 1,
      activeSessions: 0,
      licenses: [
        {
          id: "license-1",
          status: "ACTIVE",
          source: "PURCHASE",
          term: "LIFETIME",
          expiresAt: null,
          grantedAt: "2026-10-02T00:00:00.000Z",
          payments: [
            {
              id: "payment-1",
              status: "PAID",
              amountMinor: 4990,
              currency: "BRL",
              providerPaymentId: "mp-1",
              createdAt: "2026-10-02T00:00:00.000Z",
            },
          ],
        },
      ],
      recentTickets: [
        {
          id: "ticket-1",
          protocol: "RC-USER00001",
          status: "OPEN",
          priority: "NORMAL",
          createdAt: "2026-10-03T00:00:00.000Z",
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={["/admin/users/user-1"]}>
        <AdminUserDetailPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/PURCHASE/)).toBeInTheDocument();
    expect(screen.getByText(/mp-1/)).toBeInTheDocument();
    expect(screen.getByText(/49,90/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RC-USER00001" })).toHaveAttribute("href", "/admin/tickets/ticket-1");
  });
});
