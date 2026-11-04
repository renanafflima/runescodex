import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import type { BosstiaryEntry } from "../domain/bosstiary";
import { BosstiaryBossPage } from "./BosstiaryBossPage";

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
    render(
      <MemoryRouter initialEntries={["/bosstiary/ferumbras"]}>
        <Routes>
          <Route path="/bosstiary/:slug" element={<BosstiaryBossPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Ferumbras" })).toBeInTheDocument();
    expect(screen.getByText("Localização ainda não cadastrada.")).toBeInTheDocument();
    expect(screen.getByText("Sem fonte de Boss Points no RuneCodex.")).toBeInTheDocument();
    expect(screen.getByText("Tempo de combate ainda sem estimativa revisada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comentários da comunidade" })).toBeInTheDocument();
    expect(await screen.findByText("Nenhum comentário.")).toBeInTheDocument();
    expect(recordContentView).toHaveBeenCalledWith("BOSS", "ferumbras");
  });

  it("overlays reviewed profile fields when the API has them", async () => {
    getBosstiaryProfile.mockResolvedValue({
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
    });
    render(
      <MemoryRouter initialEntries={["/bosstiary/ferumbras"]}>
        <Routes>
          <Route path="/bosstiary/:slug" element={<BosstiaryBossPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Ferumbra's Citadel · Goroma · Liberty Bay")).toBeInTheDocument();
    expect(screen.getAllByText("Nemesis").length).toBeGreaterThan(0);
    expect(screen.getByText("Acesso à Citadel")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});
