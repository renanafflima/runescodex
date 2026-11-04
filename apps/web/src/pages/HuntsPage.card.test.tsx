import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HuntsPage } from "./HuntsPage";

const { listHuntsPage } = vi.hoisted(() => ({
  listHuntsPage: vi.fn(),
}));

vi.mock("../services/api/hunts", () => ({
  listHuntsPage,
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isRosterReady: true,
    activeCharacter: null,
    characters: [],
    setActiveCharacter: vi.fn(),
  }),
}));

function pageResult<T>(items: T[], extras: { total?: number } = {}) {
  return {
    items,
    page: 1,
    limit: 50,
    total: extras.total ?? items.length,
    hasMore: false,
  };
}

const baseHunt = {
  id: "h1",
  slug: "court-of-winter",
  name: "Court of Winter",
  location: "Feyrist",
  vocations: [{ vocation: "EK", isRecommended: true, levelMin: 270, xpPerHour: 4500000, profitPerHour: null }],
  bestAttack: { elements: ["FIRE"], status: "COMPLETE", creatureCount: 1, creaturesWithAnyData: 1, creaturesWithoutData: 0 },
  bestiarySummary: { totalCharmPoints: 275, creaturesWithEntry: 6, creatureCount: 6, totalEstimatedHours: null, estimatedHoursCreatureCount: 0 },
  attention: "Cuidado com o repawn duplo. Evite avançar sem limpar a área lateral.",
  creatures: [
    { name: "Thanatursus", slug: "thanatursus", isPrimary: true, damageType: "physical" },
    { name: "Hibernal Moth", slug: "hibernal-moth", damageType: "energy" },
    { name: "Crazed Winter Vanguard", slug: "crazed-winter-vanguard", damageType: "death" },
    { name: "Crazed Winter Rearguard", slug: "crazed-winter-rearguard", damageType: "earth" },
    { name: "Arachnophobica", slug: "arachnophobica", damageType: "death" },
  ],
};

describe("HuntsPage card content", () => {
  beforeEach(() => {
    listHuntsPage.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the attention banner with the exact database text when attention is filled", async () => {
    listHuntsPage.mockResolvedValue(pageResult([baseHunt]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Court of Winter")).toBeInTheDocument();
    expect(
      screen.getByText("Cuidado com o repawn duplo. Evite avançar sem limpar a área lateral."),
    ).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("hides the attention banner when attention is null or blank", async () => {
    listHuntsPage.mockResolvedValue(pageResult([{ ...baseHunt, attention: "   " }]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Court of Winter")).toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
  });

  it("lists every protection element for a hunt with multiple defense elements", async () => {
    listHuntsPage.mockResolvedValue(pageResult([baseHunt]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    const title = await screen.findByText("Court of Winter");
    const card = title.closest(".hunt-card") as HTMLElement;
    const protectionLabel = within(card).getByText("Proteção");
    const protectionList = protectionLabel.nextSibling as HTMLElement;
    expect(within(protectionList).getByAltText("Physical")).toBeInTheDocument();
    expect(within(protectionList).getByAltText("Energy")).toBeInTheDocument();
    expect(within(protectionList).getByAltText("Death")).toBeInTheDocument();
    expect(within(protectionList).getByAltText("Earth")).toBeInTheDocument();
  });

  it("shows a dash for profit per hour when the hunt has no profit", async () => {
    listHuntsPage.mockResolvedValue(pageResult([baseHunt]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Court of Winter")).toBeInTheDocument();
    expect(screen.getByText("Profit / hora").nextSibling).toHaveTextContent("—");
  });

  it("shows a +N indicator for hunts with more than three creatures", async () => {
    listHuntsPage.mockResolvedValue(pageResult([baseHunt]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Court of Winter")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows an incomplete bestiary count using the real creaturesWithEntry/creatureCount numbers", async () => {
    listHuntsPage.mockResolvedValue(
      pageResult([
        {
          ...baseHunt,
          bestiarySummary: {
            totalCharmPoints: 90,
            creaturesWithEntry: 2,
            creatureCount: 5,
            totalEstimatedHours: null,
            estimatedHoursCreatureCount: 0,
          },
        },
      ]),
    );
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Court of Winter")).toBeInTheDocument();
    expect(screen.getByText("Bestiário: 2/5")).toBeInTheDocument();
    expect(screen.getByText("Charm Points: 90")).toBeInTheDocument();
  });
});
