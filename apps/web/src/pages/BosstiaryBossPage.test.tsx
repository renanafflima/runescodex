import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import {
  BOSSTIARY_COMBAT_STRATEGY_MARKER,
  BOSSTIARY_LOOT_STRATEGY_PREFIX,
  type BosstiaryEntry,
} from "../domain/bosstiary";
import { BosstiaryBossPage, detailFacts } from "./BosstiaryBossPage";

const { loadBosstiaryCatalog, getBosstiaryProfile, listBosstiaryComments, recordContentView } = vi.hoisted(() => ({
  loadBosstiaryCatalog: vi.fn(),
  getBosstiaryProfile: vi.fn(),
  listBosstiaryComments: vi.fn(),
  recordContentView: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));
vi.mock("../domain/bosstiary-catalog", () => ({ loadBosstiaryCatalog }));
vi.mock("../services/api/bosstiary", () => ({ getBosstiaryProfile }));
vi.mock("../services/api/bosstiary-comments", () => ({
  listBosstiaryComments,
  createBosstiaryComment: vi.fn(),
  updateBosstiaryComment: vi.fn(),
  deleteBosstiaryComment: vi.fn(),
  likeBosstiaryComment: vi.fn(),
  unlikeBosstiaryComment: vi.fn(),
}));
vi.mock("../services/api/admin-portal", () => ({ recordContentView }));

function entry(overrides: Partial<BosstiaryEntry> = {}): BosstiaryEntry {
  return {
    name: "Ferumbras",
    slug: "ferumbras",
    sourceUrl: "https://www.tibiawiki.com.br/wiki/Ferumbras",
    isboss: "sim",
    source: "tibiawiki-candidate",
    party: null,
    recommendedLevel: null,
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

function factValue(facts: ReturnType<typeof detailFacts>, label: string) {
  const row = facts.find((fact) => fact.label === label);
  return row?.value ?? null;
}

function hasFactLabel(facts: ReturnType<typeof detailFacts>, label: string) {
  return facts.some((fact) => fact.label === label);
}

function renderBoss(slug = "ferumbras") {
  render(
    <MemoryRouter initialEntries={[`/bosstiary/${slug}`]}>
      <Routes>
        <Route path="/bosstiary/:slug" element={<BosstiaryBossPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function reviewedProfile(overrides: Record<string, unknown> = {}) {
  return {
    slug: "ferumbras",
    name: "Ferumbras",
    officialCategory: "Nemesis",
    huntMode: "SOLO",
    recommendedLevelSolo: 1000,
    recommendedLevelParty: null,
    difficulty: "VERY_HARD",
    locationName: "Ferumbra's Citadel",
    locationRegion: "Goroma",
    originCity: "Liberty Bay",
    accessStatus: "REQUIRED",
    accessRequirements: "Acesso à Citadel",
    howToReach: "Barco para Goroma",
    cooldownSeconds: 3600,
    estimatedCombatMinutes: 12,
    bossPoints: 50,
    mechanics: "Muda de forma",
    strategy: "Leve fire wall",
    ...overrides,
  };
}

describe("detailFacts loot and strategy", () => {
  it("case A — splits combined loot and combat strategy", () => {
    const boss = entry({
      strategy: `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Shiny Blade, Mycological Bow${BOSSTIARY_COMBAT_STRATEGY_MARKER}Leve fire wall e controle os summons.`,
    });
    const facts = detailFacts(boss);
    expect(factValue(facts, "Recompensas / drops")).toBe("Shiny Blade, Mycological Bow");
    expect(factValue(facts, "Estratégia recomendada")).toBe("Leve fire wall e controle os summons.");
  });

  it("case B — shows loot only", () => {
    const boss = entry({
      strategy: `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Demon Shield`,
    });
    const facts = detailFacts(boss);
    expect(factValue(facts, "Recompensas / drops")).toBe("Demon Shield");
    expect(hasFactLabel(facts, "Estratégia recomendada")).toBe(false);
  });

  it("case C — shows combat strategy only", () => {
    const boss = entry({ strategy: "Leve fire wall e controle os summons." });
    const facts = detailFacts(boss);
    expect(hasFactLabel(facts, "Recompensas / drops")).toBe(false);
    expect(factValue(facts, "Estratégia recomendada")).toBe("Leve fire wall e controle os summons.");
  });

  it("case D — uses rewards[] when strategy is empty", () => {
    const boss = entry({
      rewards: [
        { name: "Golden Helmet", imageUrl: null },
        { name: "Magic Sword", imageUrl: null },
      ],
    });
    const facts = detailFacts(boss);
    expect(factValue(facts, "Recompensas / drops")).toBe("Golden Helmet, Magic Sword");
    expect(hasFactLabel(facts, "Estratégia recomendada")).toBe(false);
  });

  it("case E — prefers parsed loot and avoids duplicate rewards listing", () => {
    const boss = entry({
      strategy: `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Soul Orb`,
      rewards: [{ name: "Soul Orb", imageUrl: null }, { name: "Crystal Coin", imageUrl: null }],
    });
    const facts = detailFacts(boss);
    expect(factValue(facts, "Recompensas / drops")).toBe("Soul Orb");
  });

  it("case F — shows discrete placeholders when data is missing", () => {
    const facts = detailFacts(entry());
    expect(factValue(facts, "Categoria do Bosstiário")).toBe("—");
    expect(factValue(facts, "Localização")).toBe("—");
    expect(factValue(facts, "Como chegar / acesso")).toBe("—");
    expect(factValue(facts, "Recompensas / drops")).toBe("—");
    expect(hasFactLabel(facts, "Estratégia recomendada")).toBe(false);
    expect(factValue(facts, "Mecânicas")).toBe("—");
  });
});

describe("BosstiaryBossPage", () => {
  beforeEach(() => {
    loadBosstiaryCatalog.mockReturnValue({ skipped: 0, entries: [entry()] });
    getBosstiaryProfile.mockRejectedValue(new ApiError("HTTP_ERROR", 404, "missing", null));
    listBosstiaryComments.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, hasMore: false, commentCount: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a candidate boss with pending facts and keeps comments on the detail screen", async () => {
    renderBoss();
    expect(await screen.findByRole("heading", { name: "Ferumbras" })).toBeInTheDocument();
    const sheet = screen.getByRole("article");
    expect(within(sheet).getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("Boss Points")).not.toBeInTheDocument();
    expect(screen.queryByText("Cooldown")).not.toBeInTheDocument();
    expect(screen.queryByText("Dificuldade")).not.toBeInTheDocument();
    expect(screen.queryByText(/isboss =/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comentários da comunidade" })).toBeInTheDocument();
    expect(await screen.findByText("Nenhum comentário.")).toBeInTheDocument();
    expect(recordContentView).toHaveBeenCalledWith("BOSS", "ferumbras");
  });

  it("overlays reviewed profile fields when the API has them", async () => {
    getBosstiaryProfile.mockResolvedValue(reviewedProfile());
    renderBoss();
    expect(await screen.findByText("Ferumbra's Citadel · Goroma · Liberty Bay")).toBeInTheDocument();
    expect(screen.getByText("Nemesis")).toBeInTheDocument();
    expect(screen.queryByText("Classificação pendente")).not.toBeInTheDocument();
    expect(screen.getByText(/Barco para Goroma[\s\S]*Acesso à Citadel/)).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("Leve fire wall")).toBeInTheDocument();
    expect(screen.queryByText("50")).not.toBeInTheDocument();
    expect(screen.getByText("Perfil revisado")).toBeInTheDocument();
  });

  it("renders non-standard solo and party levels from the reviewed profile", async () => {
    getBosstiaryProfile.mockResolvedValue(
      reviewedProfile({
        recommendedLevelSolo: 450,
        recommendedLevelParty: 250,
        strategy: null,
      }),
    );
    renderBoss();
    expect(await screen.findByText("450")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("renders split loot and strategy on the sheet", async () => {
    getBosstiaryProfile.mockResolvedValue(
      reviewedProfile({
        strategy: `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Shiny Blade, Mycological Bow${BOSSTIARY_COMBAT_STRATEGY_MARKER}Leve fire wall e controle os summons.`,
        mechanics: "Invoca adds",
      }),
    );
    renderBoss();
    expect(await screen.findByText("Shiny Blade, Mycological Bow")).toBeInTheDocument();
    expect(screen.getByText("Leve fire wall e controle os summons.")).toBeInTheDocument();
    expect(screen.getByText("Invoca adds")).toBeInTheDocument();
  });
});
