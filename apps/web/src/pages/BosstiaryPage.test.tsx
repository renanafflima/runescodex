import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BosstiaryEntry } from "../domain/bosstiary";
import { BosstiaryPage } from "./BosstiaryPage";

const { loadBosstiaryCatalog, findBosstiaryRotations } = vi.hoisted(() => ({
  loadBosstiaryCatalog: vi.fn(),
  findBosstiaryRotations: vi.fn(),
}));

vi.mock("../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog,
}));

vi.mock("../services/api/bosstiary", () => ({
  findBosstiaryRotations,
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

  it("opens on the rotations planner with selectable time cards", () => {
    show();
    expect(screen.getByRole("heading", { name: "Monte sua rotação" })).toBeInTheDocument();
    expect(screen.getByText(/Quanto tempo você tem hoje/i)).toBeInTheDocument();
    expect(screen.queryByText(/candidatos da TibiaWiki com isboss/i)).not.toBeInTheDocument();

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
    show();
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
