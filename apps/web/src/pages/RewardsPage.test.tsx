import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardsPage } from "./RewardsPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ activeCharacter: { name: "Rune Knight" } }),
}));

vi.mock("../services/api/rewards", () => ({
  getRewardsMe: vi.fn(async () => ({
    wallet: { points: 450, gold: 2, diamond: 0 },
    conversions: {
      pointsToGold: [{ amount: 1, pointsCost: 10000, goldGranted: 1, enabled: true }],
      goldToDiamond: { enabled: false, rate: null },
    },
  })),
  listRewardMissions: vi.fn(async () => [
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
      current: 0,
      target: 1,
      rewardPoints: 10,
      completed: false,
    },
  ]),
  listRewardCatalog: vi.fn(async () => [
    {
      id: "tc",
      name: "125 Tibia Coins",
      description: "Recompensa digital.",
      imageKey: "tc125",
      currency: "GOLD",
      price: 5,
      priceConfigured: true,
    },
  ]),
  listRewardRedemptions: vi.fn(async () => []),
  convertRewards: vi.fn(),
  redeemReward: vi.fn(),
}));

describe("RewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
