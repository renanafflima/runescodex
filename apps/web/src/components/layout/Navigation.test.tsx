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

    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
  });

  it("shows the administration portal to an administrator", () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute("href", "/admin");
  });
});
