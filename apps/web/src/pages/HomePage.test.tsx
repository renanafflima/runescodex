import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    activeCharacter: null,
    user: null,
  }),
}));

vi.mock("../services/api/client", () => ({
  apiConfiguration: { configured: true },
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("Home portal", () => {
  afterEach(() => cleanup());

  it("opens catalog shortcuts from the whole card and hides Em breve", () => {
    renderHome();

    const rewards = screen.getByRole("link", { name: /Rewards Missões, pontos e conquistas/i });
    expect(rewards).toHaveAttribute("href", "/rewards");
    expect(rewards).not.toHaveTextContent(/em breve/i);

    expect(screen.getByRole("link", { name: /Hunts Onde caçar agora/i })).toHaveAttribute("href", "/hunts");
    expect(screen.getByRole("link", { name: /Bestiário Criaturas e spawns/i })).toHaveAttribute(
      "href",
      "/bestiary",
    );
    expect(screen.getByRole("link", { name: /Bosstiário Bosses, progresso e rotas/i })).toHaveAttribute(
      "href",
      "/bosstiary",
    );
    expect(screen.getByRole("link", { name: /Charm Guides Guias para completar charms/i })).toHaveAttribute(
      "href",
      "/bestiary",
    );
    expect(screen.getByRole("link", { name: /Comunidade Fórum e rotas compartilhadas/i })).toHaveAttribute(
      "href",
      "/forum",
    );
    expect(screen.queryByText(/em breve/i)).not.toBeInTheDocument();
  });

  it("keeps the audited home heading and stacks install CTA in the hero", () => {
    const { container } = renderHome();
    expect(screen.getByRole("heading", { level: 1, name: /Mais que caçar/i })).toBeInTheDocument();
    const hero = container.querySelector(".home-portal-hero");
    expect(hero).not.toBeNull();
    expect(hero?.querySelector(".home-portal-install, .home-portal-hero__actions")).not.toBeNull();
    expect(container.querySelector(".home-portal-shortcuts__grid")).not.toBeNull();
  });

  it("renders independent ad slots as internal placeholders", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /Campanha da temporada/i })).toHaveAttribute("href", "/rewards");
    expect(screen.getByRole("link", { name: /Espaço publicitário intermediário/i })).toHaveAttribute(
      "href",
      "/hunts",
    );
    expect(screen.getByRole("link", { name: /Espaço publicitário inferior/i })).toHaveAttribute(
      "href",
      "/forum",
    );
  });

  it("uses editorial news and community content for anonymous visitors", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /Charm Guides no Bestiário/i })).toHaveAttribute(
      "href",
      "/bestiary",
    );
    expect(screen.getByRole("link", { name: /Rotas de bosses/i })).toHaveAttribute("href", "/bosstiary");
    expect(screen.getByRole("link", { name: /Abrir Rewards/i })).toHaveAttribute("href", "/rewards");
  });
});
