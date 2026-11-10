import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRotationsFeed } from "./CommunityRotationsFeed";

const {
  listCommunityRotations,
  listCommunityRotationRanking,
  createCommunityRotationTest,
} = vi.hoisted(() => ({
  listCommunityRotations: vi.fn(),
  listCommunityRotationRanking: vi.fn(),
  createCommunityRotationTest: vi.fn(),
}));

vi.mock("../../services/api/community-rotations", () => ({
  listCommunityRotations,
  listCommunityRotationRanking,
  likeCommunityRotation: vi.fn(),
  unlikeCommunityRotation: vi.fn(),
  favoriteCommunityRotation: vi.fn(),
  unfavoriteCommunityRotation: vi.fn(),
  createCommunityRotation: vi.fn(),
  createCommunityRotationTest,
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
    createCommunityRotationTest.mockReset();
    listCommunityRotations.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    });
    listCommunityRotationRanking.mockResolvedValue([]);
    createCommunityRotationTest.mockResolvedValue({ id: "test-1" });
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

  it("shows compact cards and records a single evaluation", async () => {
    listCommunityRotations.mockResolvedValue({
      items: [
        {
          id: "rot-1",
          title: "Loop do Oberon",
          description: null,
          accessRequirements: null,
          additionalInfo: null,
          recommendedLevel: "L500",
          recommendedLevelLabel: "500+",
          huntMode: "SOLO",
          plannedDurationMinutes: 30,
          vocation: "EK",
          characterLevel: 512,
          partySize: null,
          observedTotalMinutes: null,
          combatMinutes: null,
          travelMinutes: null,
          status: "PUBLISHED",
          createdAt: "2026-11-09T12:00:00.000Z",
          updatedAt: "2026-11-09T12:00:00.000Z",
          author: { id: "user-2", name: "Nyx", vocation: "EK", level: 512 },
          bosses: [
            {
              id: "stop-2",
              position: 2,
              notes: null,
              bossId: null,
              bossName: "The Pale Worm",
              slug: "the-pale-worm",
              name: "The Pale Worm",
              image: "arquivo-inexistente.gif",
            },
            {
              id: "stop-1",
              position: 1,
              notes: null,
              bossId: "boss-1",
              bossName: "Grand Master Oberon",
              slug: "grand-master-oberon",
              name: "Grand Master Oberon",
              image: null,
            },
          ],
          likesCount: 2,
          favoritesCount: 1,
          commentsCount: 3,
          likedByMe: false,
          favoritedByMe: false,
          testedByAuthor: false,
          testedByMe: false,
          featured: false,
        },
      ],
      page: 1,
      limit: 12,
      total: 1,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <CommunityRotationsFeed />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Loop do Oberon")).toBeInTheDocument();
    expect(screen.getByText("Nyx")).toBeInTheDocument();
    const sequence = screen.getByRole("list", { name: "Bosses na rotação" });
    const text = sequence.textContent ?? "";
    expect(text.indexOf("1.")).toBeLessThan(text.indexOf("Grand Master Oberon"));
    expect(text.indexOf("Grand Master Oberon")).toBeLessThan(text.indexOf("2."));
    expect(text.indexOf("2.")).toBeLessThan(text.indexOf("The Pale Worm"));
    expect(text).toContain("→");
    expect(sequence.querySelector("img")).toBeTruthy();
    expect(sequence.querySelector(".catalog-image--fallback")).toHaveTextContent("T");
    fireEvent.click(screen.getByRole("button", { name: "Funcionou pra mim" }));
    await waitFor(() => expect(createCommunityRotationTest).toHaveBeenCalledWith("rot-1", {}));
  });
});
