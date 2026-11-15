import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

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

  it("replaces the hero with the partner banner carousel", () => {
    const { container } = renderHome();
    expect(screen.queryByRole("heading", { level: 1, name: /Mais que caçar/i })).not.toBeInTheDocument();
    expect(container.querySelector(".home-portal-hero")).toBeNull();
    expect(container.querySelector(".home-portal-partners")).not.toBeNull();
    expect(screen.getByRole("img", { name: /Campanha de parceria RuneCodex/i })).toBeInTheDocument();
    expect(container.querySelector(".home-portal-shortcuts__grid")).not.toBeNull();
  });

  it("shows the promo campaign and removes the middle ad slot", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /Não perca a promoção de Natal!/i })).toHaveAttribute(
      "href",
      "/rewards",
    );
    expect(screen.getByText(/Indique um amigo e ganhe 25 TC Globais/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Espaço publicitário intermediário/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Espaço publicitário inferior/i })).not.toBeInTheDocument();
  });

  it("shows the institutional TriTech banner at the end", () => {
    renderHome();
    const tritech = screen.getByRole("link", { name: /TriTech — Soluções Digitais/i });
    expect(tritech).toHaveAttribute("href", "https://tritech.app.br");
    expect(tritech).toHaveAttribute("target", "_blank");
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