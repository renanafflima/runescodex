import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Navigation } from "./Navigation";

const auth = vi.hoisted(() => ({
  user: null as { id: string; role?: string } | null,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

describe("Navigation admin entry", () => {
  it("hides hunt requests from a regular user", () => {
    auth.user = { id: "user-1", role: "USER" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Solicitações de Hunts" })).not.toBeInTheDocument();
  });

  it("shows hunt requests to an administrator", () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Solicitações de Hunts" })).toHaveAttribute(
      "href",
      "/admin/hunt-update-requests",
    );
  });
});
