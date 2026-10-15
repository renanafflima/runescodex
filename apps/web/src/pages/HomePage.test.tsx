import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    activeCharacter: null,
  }),
}));

vi.mock("../services/api/client", () => ({
  apiConfiguration: { configured: true },
}));

describe("Home rewards card", () => {
  it("opens the rewards screen from the whole card and hides Em breve", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const rewards = screen.getByRole("link", { name: /Rewards/i });
    expect(rewards).toHaveAttribute("href", "/rewards");
    expect(rewards).toHaveTextContent("Missões, pontos e conquistas");
    expect(rewards).not.toHaveTextContent(/em breve/i);

    expect(screen.getByRole("link", { name: /Hunts/i })).toHaveAttribute("href", "/hunts");
    expect(screen.getByRole("link", { name: /Bestiário/i })).toHaveAttribute("href", "/bestiary");
    expect(screen.getByRole("link", { name: /Fórum/i })).toHaveAttribute("href", "/forum");
    expect(screen.queryByText(/em breve/i)).not.toBeInTheDocument();
  });
});
