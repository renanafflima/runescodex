import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./AppRoutes";

const auth = vi.hoisted(() => ({
  status: "anonymous" as "loading" | "anonymous" | "authenticated",
  isAuthenticated: false,
  user: null as {
    id: string;
    role?: string;
    premium?: { access: boolean; paymentStatus: string };
  } | null,
  refreshMe: vi.fn(),
  characters: [],
  activeCharacter: null,
  setActiveCharacter: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../services/api/client", () => ({
  apiConfiguration: { configured: true },
}));

vi.mock("../pages/HuntsPage", () => ({
  HuntsPage: () => <h1>Hunts protegidas</h1>,
}));
vi.mock("../pages/HuntDetailPage", () => ({
  HuntDetailPage: () => <h1>Hunt protegida</h1>,
}));
vi.mock("../pages/BestiaryPage", () => ({
  BestiaryPage: () => <h1>Bestiário protegido</h1>,
}));
vi.mock("../pages/BosstiaryPage", () => ({
  BosstiaryPage: () => <h1>Bosstiário protegido</h1>,
}));
vi.mock("../pages/BestiaryCreaturePage", () => ({
  BestiaryCreaturePage: () => <h1>Criatura protegida</h1>,
}));
vi.mock("../pages/BestiaryDetailPage", () => ({
  BestiaryDetailPage: () => <h1>Detalhe protegido</h1>,
}));
vi.mock("../pages/BestiaryHuntsPage", () => ({
  BestiaryHuntsPage: () => <h1>Hunts da criatura</h1>,
}));
vi.mock("../pages/ForumPage", () => ({
  ForumPage: () => <h1>Fórum protegido</h1>,
}));
vi.mock("../pages/ForumComposePage", () => ({
  ForumComposePage: () => <h1>Novo tópico protegido</h1>,
}));
vi.mock("../pages/ForumThreadPage", () => ({
  ForumThreadPage: () => <h1>Tópico protegido</h1>,
}));
vi.mock("../pages/RewardsPage", () => ({
  RewardsPage: () => <h1>Rewards protegido</h1>,
}));
vi.mock("../pages/ProfilePage", () => ({
  ProfilePage: () => <h1>Perfil protegido</h1>,
}));
vi.mock("../pages/AdminHuntUpdateRequestsPage", () => ({
  AdminHuntUpdateRequestsPage: () => <h1>Solicitações de atualização</h1>,
}));

function show(path: string) {
  cleanup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("Web premium routes", () => {
  beforeEach(() => {
    auth.status = "anonymous";
    auth.isAuthenticated = false;
    auth.user = null;
  });

  it("keeps home, login and checkout available without premium", () => {
    show("/");
    expect(screen.getByRole("heading", { name: /Mais que caçar/i })).toBeInTheDocument();

    show("/login");
    expect(screen.getByRole("heading", { name: /Entrar na sua conta/i })).toBeInTheDocument();

    auth.status = "authenticated";
    auth.isAuthenticated = true;
    auth.user = { id: "user-1", role: "USER", premium: { access: false, paymentStatus: "NONE" } };
    show("/checkout");
    expect(screen.getByRole("heading", { name: "Acesso Premium" })).toBeInTheDocument();
  });

  it("sends product routes to checkout when the license is inactive", () => {
    auth.status = "authenticated";
    auth.isAuthenticated = true;
    auth.user = { id: "user-1", role: "USER", premium: { access: false, paymentStatus: "PENDING" } };

    for (const path of [
      "/hunts",
      "/hunts/cyclops",
      "/bestiary",
      "/bosstiary",
      "/bestiary/rat",
      "/bestiary/rat/hunts",
      "/forum",
      "/forum/new",
      "/forum/11111111-1111-4111-8111-111111111111",
      "/rewards",
      "/profile",
    ]) {
      show(path);
      expect(screen.getByRole("heading", { name: "Acesso Premium" })).toBeInTheDocument();
      expect(screen.getByText(/Pagamento pendente/i)).toBeInTheDocument();
    }
  });

  it("opens a protected route when premium is active", () => {
    auth.status = "authenticated";
    auth.isAuthenticated = true;
    auth.user = {
      id: "user-1",
      role: "USER",
      premium: { access: true, paymentStatus: "PAID" },
    };

    show("/hunts");
    expect(screen.getByRole("heading", { name: "Hunts protegidas" })).toBeInTheDocument();
  });

  it("does not open admin tools for a regular user", () => {
    auth.status = "authenticated";
    auth.isAuthenticated = true;
    auth.user = { id: "user-1", role: "USER", premium: { access: true, paymentStatus: "PAID" } };

    show("/admin/hunt-update-requests");
    expect(screen.queryByRole("heading", { name: "Solicitações de atualização" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Mais que caçar/i })).toBeInTheDocument();
  });
});
