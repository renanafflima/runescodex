import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BosstiaryEntry } from "../domain/bosstiary";
import { BosstiaryPage } from "./BosstiaryPage";

const { loadBosstiaryCatalog, findBosstiaryRotations, listCommunityRotations } = vi.hoisted(() => ({
  loadBosstiaryCatalog: vi.fn(),
  findBosstiaryRotations: vi.fn(),
  listCommunityRotations: vi.fn(),
}));

vi.mock("../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog,
}));

vi.mock("../services/api/bosstiary", () => ({
  findBosstiaryRotations,
}));

vi.mock("../services/api/community-rotations", () => ({
  listCommunityRotations,
  listCommunityRotationRanking: vi.fn(async () => []),
  likeCommunityRotation: vi.fn(),
  unlikeCommunityRotation: vi.fn(),
}));

vi.mock("../services/api/rewards", () => ({
  getRewardsMe: vi.fn(async () => ({ wallet: { points: 0, gold: 0, diamond: 0 } })),
  listRewardMissions: vi.fn(async () => []),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    activeCharacter: { id: "1", name: "Hero", vocation: "EK", level: 300, world: "Antica" },
    characters: [],
    isAuthenticated: true,
    isReady: true,
    isRosterReady: true,
  }),
}));

function entry(overrides: Partial<BosstiaryEntry> = {}): BosstiaryEntry {
  return {
    name: "Ferumbras",
    slug: "ferumbras",
    sourceUrl: "https://www.tibiawiki.com.br/wiki/Ferumbras",
    isboss: "sim",
    source: "tibiawiki-candidate",
    party: "solo",
    recommendedLevel: 300,
    recommendedLevelSolo: null,
    recommendedLevelParty: null,
    imageUrl: "/ferumbras.gif",
    rewards: [],
    location: null,
    locationRegion: null,
    originCity: null,
    bossPoints: null,
    officialCategory: null,
    difficulty: null,
    accessStatus: null,
    accessRequirements: null,
    howToReach: null,
    cooldownSeconds: null,
    estimatedCombatMinutes: null,
    mechanics: null,
    strategy: null,
    ...overrides,
  };
}

describe("BosstiaryPage", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    loadBosstiaryCatalog.mockReset();
    findBosstiaryRotations.mockReset();
    listCommunityRotations.mockReset();
    listCommunityRotations.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    });
    loadBosstiaryCatalog.mockReturnValue({
      skipped: 0,
      entries: [
        entry(),
        entry({
          name: "Ghazbaran",
          slug: "ghazbaran",
          sourceUrl: "https://www.tibiawiki.com.br/wiki/Ghazbaran",
          party: null,
          recommendedLevel: null,
          imageUrl: null,
        }),
      ],
    });
    findBosstiaryRotations.mockResolvedValue({
      items: [],
      emptyReason: "Sem rotações verificadas.",
      dataGaps: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  function show(initial = "/bosstiary") {
    render(
      <MemoryRouter initialEntries={[initial]}>
        <BosstiaryPage />
      </MemoryRouter>,
    );
  }

  it("opens on the community feed by default", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "Rotações da Comunidade" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Monte sua rotação" })).not.toBeInTheDocument();
    expect(listCommunityRotations).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Comunidade" })).toHaveAttribute("aria-current", "page");
  });

  it("renders four section cards with distinct artwork", () => {
    show();
    const nav = screen.getByRole("navigation", { name: "Seções do Bosstiário" });
    expect(nav.querySelectorAll("img")).toHaveLength(4);
    const sources = [...nav.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(new Set(sources).size).toBe(4);
  });

  it("shows the rotations planner on the rotas tab", () => {
    show("?tab=rotas");
    expect(screen.getByRole("heading", { name: "Monte sua rotação" })).toBeInTheDocument();
    const card20 = screen.getByRole("button", { name: /20 min/i });
    fireEvent.click(card20);
    expect(card20).toHaveAttribute("aria-pressed", "true");
  });

  it("loads encyclopedia content only on its tab", async () => {
    show();
    expect(loadBosstiaryCatalog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enciclopédia" }));
    await waitFor(() => expect(loadBosstiaryCatalog).toHaveBeenCalled());
    expect(screen.getByText(/candidatos da TibiaWiki com isboss/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ferumbras/ })).toBeInTheDocument();
  });

  it("filters encyclopedia entries and opens the boss modal", async () => {
    show("?tab=enciclopedia");
    await waitFor(() => expect(screen.getByRole("button", { name: /Ferumbras/ })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Buscar boss pelo nome"), { target: { value: "ghaz" } });
    expect(screen.queryByRole("button", { name: /Ferumbras/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar boss pelo nome"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    fireEvent.click(screen.getByRole("button", { name: "300" }));
    fireEvent.click(screen.getByRole("button", { name: /Ferumbras/ }));
    expect(screen.getByRole("dialog", { name: "Ferumbras" })).toBeInTheDocument();
  });

  it("calls the rotations service from the planner", async () => {
    show("?tab=rotas");
    fireEvent.click(screen.getByRole("button", { name: "Encontrar rotações" }));
    await waitFor(() => expect(findBosstiaryRotations).toHaveBeenCalled());
    expect(await screen.findByText("Sem rotações verificadas.")).toBeInTheDocument();
  });

  it("shows the catalog error state on the encyclopedia tab", async () => {
    loadBosstiaryCatalog.mockImplementation(() => {
      throw new Error("Lista ilegível");
    });
    show("?tab=enciclopedia");
    expect(await screen.findByText("Lista ilegível")).toBeInTheDocument();
  });
});
