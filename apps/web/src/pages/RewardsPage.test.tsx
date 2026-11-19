import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsPage } from "./RewardsPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ activeCharacter: { name: "Rune Knight" } }),
}));

const listRewardMissionsBoard = vi.fn();
const getRewardsMe = vi.fn();
const listRewardCatalog = vi.fn();
const listRewardRedemptions = vi.fn();

vi.mock("../services/api/rewards", () => ({
  getRewardsMe: (...args: unknown[]) => getRewardsMe(...args),
  listRewardMissionsBoard: (...args: unknown[]) => listRewardMissionsBoard(...args),
  listRewardCatalog: (...args: unknown[]) => listRewardCatalog(...args),
  listRewardRedemptions: (...args: unknown[]) => listRewardRedemptions(...args),
  convertRewards: vi.fn(),
  redeemReward: vi.fn(),
}));

const board = {
  DAILY: [
    {
      id: "forum",
      title: "Poste no Fórum",
      description: "Crie um tópico útil.",
      category: "COMMUNITY",
      period: "DAILY",
      imageKey: "missionForum",
      eventType: "FORUM_TOPIC_CREATED",
      current: 0,
      target: 1,
      rewardPoints: 20,
      completed: false,
      periodEnd: "2026-10-29T00:00:00.000Z",
    },
    {
      id: "ads",
      title: "Assista anúncios",
      description: "Ganhe pontos assistindo.",
      category: "ADS",
      period: "DAILY",
      eventType: "AD_WATCHED",
      eventImplemented: false,
      functional: false,
      current: 0,
      target: 1,
      rewardPoints: 10,
      completed: false,
    },
  ],
  WEEKLY: [
    {
      id: "weekly-forum",
      title: "Scribe Semanal",
      description: "Publique no fórum.",
      category: "COMMUNITY",
      period: "WEEKLY",
      eventType: "FORUM_TOPIC_CREATED",
      current: 0,
      target: 3,
      rewardPoints: 80,
      completed: false,
      periodEnd: "2026-11-01T00:00:00.000Z",
    },
  ],
  MONTHLY: [
    {
      id: "monthly-bestiary",
      title: "Explorador Mensal",
      description: "Abra criaturas no bestiário.",
      category: "BESTIARY",
      period: "MONTHLY",
      eventType: "CREATURE_VIEWED",
      current: 0,
      target: 10,
      rewardPoints: 200,
      completed: false,
      periodEnd: "2026-12-01T00:00:00.000Z",
    },
  ],
};

describe("RewardsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getRewardsMe.mockResolvedValue({
      wallet: { points: 450, gold: 2, diamond: 0 },
      conversions: {
        pointsToGold: [{ amount: 1, pointsCost: 10000, goldGranted: 1, enabled: true }],
        goldToDiamond: { enabled: false, rate: null },
      },
    });
    listRewardMissionsBoard.mockResolvedValue(board);
    listRewardCatalog.mockResolvedValue([
      {
        id: "tc",
        name: "125 Tibia Coins",
        description: "Recompensa digital.",
        imageKey: "tc125",
        currency: "GOLD",
        price: 5,
        priceConfigured: true,
      },
    ]);
    listRewardRedemptions.mockResolvedValue([]);
  });

  it("renders the reference composition with real data and hides unsupported missions", async () => {
    render(
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "REWARDS" })).toBeInTheDocument();
    expect(screen.getByText("Rune Knight")).toBeInTheDocument();
    expect(screen.getByText("Poste no Fórum")).toBeInTheDocument();
    expect(screen.queryByText("Assista anúncios")).not.toBeInTheDocument();
    expect(screen.getByText("125 Tibia Coins")).toBeInTheDocument();
    expect(screen.getAllByText("450").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EM BREVE").length).toBeGreaterThan(0);
    expect(listRewardMissionsBoard).toHaveBeenCalledTimes(1);
  });

  it("loads all periods once and switches tabs without new board requests", async () => {
    render(
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Poste no Fórum")).toBeInTheDocument();
    expect(listRewardMissionsBoard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("tab", { name: /^Semanais/i }));
    expect(await screen.findByText("Scribe Semanal")).toBeInTheDocument();
    expect(screen.queryByText("Poste no Fórum")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Mensais/i }));
    expect(await screen.findByText("Explorador Mensal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Diárias/i }));
    expect(await screen.findByText("Poste no Fórum")).toBeInTheDocument();

    await waitFor(() => {
      expect(listRewardMissionsBoard).toHaveBeenCalledTimes(1);
    });
  });
});
