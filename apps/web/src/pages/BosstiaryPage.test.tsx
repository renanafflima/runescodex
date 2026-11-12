import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BosstiaryEntry } from "../domain/bosstiary";
import { BosstiaryPage } from "./BosstiaryPage";

const {
  loadBosstiaryCatalog,
  findBosstiaryRotations,
  listCommunityRotations,
  getBosstiaryProgressSummary,
} = vi.hoisted(() => ({
  loadBosstiaryCatalog: vi.fn(),
  findBosstiaryRotations: vi.fn(),
  listCommunityRotations: vi.fn(),
  getBosstiaryProgressSummary: vi.fn(),
}));

vi.mock("../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog,
}));

vi.mock("../services/api/bosstiary", () => ({
  findBosstiaryRotations,
  listBosstiaryBosses: vi.fn(async () => ({ items: [], page: 1, limit: 8, total: 0, hasMore: false })),
}));

vi.mock("../services/api/community-rotations", () => ({
  listCommunityRotations,
  listCommunityRotationRanking: vi.fn(async () => []),
  likeCommunityRotation: vi.fn(),
  unlikeCommunityRotation: vi.fn(),
  favoriteCommunityRotation: vi.fn(),
  unfavoriteCommunityRotation: vi.fn(),
  createCommunityRotation: vi.fn(),
  createCommunityRotationTest: vi.fn(),
}));

vi.mock("../services/api/parties", () => ({
  listMyParties: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listReceivedPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listSentPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listPartyNotifications: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listHuntSessions: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listPartyRotations: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  markPartyNotificationRead: vi.fn(),
  cancelPartyInvite: vi.fn(),
  cancelHuntSession: vi.fn(),
  transferPartyLeader: vi.fn(),
  createParty: vi.fn(),
}));

vi.mock("../services/api/bosstiary-progress", () => ({
  getBosstiaryProgressSummary,
  listBosstiaryProgressActivities: vi.fn(async () => ({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  })),
  listBosstiaryProgressRotations: vi.fn(async () => []),
  listBosstiaryProgressChecklist: vi.fn(async () => ({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  })),
  createBosstiaryProgressActivity: vi.fn(),
  updateBosstiaryProgressActivity: vi.fn(),
  deleteBosstiaryProgressActivity: vi.fn(),
  updateBosstiaryProgressChecklist: vi.fn(),
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
    getBosstiaryProgressSummary.mockReset();
    listCommunityRotations.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    });
    getBosstiaryProgressSummary.mockResolvedValue({
      bossesDefeated: 0,
      dropsRegistered: 0,
      activitiesRegistered: 0,
      bossesTracked: 0,
      bossesCataloged: 0,
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

  it("renders three section cards with distinct artwork", () => {
    show();
    const nav = screen.getByRole("navigation", { name: "Seções do Bosstiário" });
    expect(nav.querySelectorAll("img")).toHaveLength(3);
    const sources = [...nav.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(new Set(sources).size).toBe(3);
    expect(screen.getByRole("button", { name: /Meu Progresso/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rotações$/ })).not.toBeInTheDocument();
  });

  it("hides the planner and keeps level inside the community area", async () => {
    show("?tab=rotas");
    expect(await screen.findByRole("heading", { name: "Rotações da Comunidade" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Planejador" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Monte sua rotação" })).not.toBeInTheDocument();
  });

  it("opens recommendations by level from the community area", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Recomendações por level" }));
    await waitFor(() => expect(loadBosstiaryCatalog).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Boss por level" })).toBeInTheDocument();
  });

  it("loads encyclopedia content only on its tab", async () => {
    show();
    expect(loadBosstiaryCatalog).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Enciclopédia/i }));
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

  it("does not open the planner from a legacy view query", async () => {
    show("?view=planner");
    expect(await screen.findByRole("heading", { name: "Rotações da Comunidade" })).toBeInTheDocument();
    expect(findBosstiaryRotations).not.toHaveBeenCalled();
  });

  it("shows personal progress from live summary data", async () => {
    show("?tab=progresso");
    expect(await screen.findByRole("heading", { name: "Meu Progresso" })).toBeInTheDocument();
    await waitFor(() => expect(getBosstiaryProgressSummary).toHaveBeenCalled());
    expect(screen.getByText("Bosses derrotados")).toBeInTheDocument();
  });

  it("shows the catalog error state on the encyclopedia tab", async () => {
    loadBosstiaryCatalog.mockImplementation(() => {
      throw new Error("Lista ilegível");
    });
    show("?tab=enciclopedia");
    expect(await screen.findByText("Lista ilegível")).toBeInTheDocument();
  });
});
