import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRotationsFeed } from "./CommunityRotationsFeed";

const { listCommunityRotations, listCommunityRotationRanking } = vi.hoisted(() => ({
  listCommunityRotations: vi.fn(),
  listCommunityRotationRanking: vi.fn(),
}));

vi.mock("../../services/api/community-rotations", () => ({
  listCommunityRotations,
  listCommunityRotationRanking,
  likeCommunityRotation: vi.fn(),
  unlikeCommunityRotation: vi.fn(),
}));

vi.mock("../../services/api/rewards", () => ({
  getRewardsMe: vi.fn(async () => ({ wallet: { points: 0, gold: 0, diamond: 0 } })),
  listRewardMissions: vi.fn(async () => []),
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "user-1" },
    activeCharacter: { name: "Hero" },
  }),
}));

describe("CommunityRotationsFeed", () => {
  beforeEach(() => {
    listCommunityRotations.mockReset();
    listCommunityRotationRanking.mockReset();
    listCommunityRotations.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    });
    listCommunityRotationRanking.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders header and loads the feed", async () => {
    render(
      <MemoryRouter>
        <CommunityRotationsFeed />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Rotações da Comunidade" })).toBeInTheDocument();
    await waitFor(() => expect(listCommunityRotations).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "Nenhuma rotação encontrada" })).toBeInTheDocument();
  });
});
