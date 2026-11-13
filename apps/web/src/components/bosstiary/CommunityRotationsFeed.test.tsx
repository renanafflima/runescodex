import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRotationsFeed } from "./CommunityRotationsFeed";

const {
  listCommunityRotations,
  listCommunityRotationRanking,
  createCommunityRotationTest,
  deleteCommunityRotation,
} = vi.hoisted(() => ({
  listCommunityRotations: vi.fn(),
  listCommunityRotationRanking: vi.fn(),
  createCommunityRotationTest: vi.fn(),
  deleteCommunityRotation: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { id: "user-1", role: "USER" } as { id: string; role?: string },
  activeCharacter: { name: "Hero" },
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
  deleteCommunityRotation,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

function rotationCard() {
  return {
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
  };
}

describe("CommunityRotationsFeed", () => {
  beforeEach(() => {
    auth.user = { id: "user-1", role: "USER" };
    listCommunityRotations.mockReset();
    listCommunityRotationRanking.mockReset();
    createCommunityRotationTest.mockReset();
    deleteCommunityRotation.mockReset();
    listCommunityRotations.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      hasMore: false,
    });
    listCommunityRotationRanking.mockResolvedValue([]);
    createCommunityRotationTest.mockResolvedValue({ id: "test-1" });
    deleteCommunityRotation.mockResolvedValue({ id: "rot-1", removed: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders header and loads the feed without weekly rewards", async () => {
    render(
      <MemoryRouter>
        <CommunityRotationsFeed />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Rotações da Comunidade" })).toBeInTheDocument();
    await waitFor(() => expect(listCommunityRotations).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "Nenhuma rotação encontrada" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recompensas semanais" })).not.toBeInTheDocument();
  });

  it("shows compact cards and records a single evaluation", async () => {
    listCommunityRotations.mockResolvedValue({
      items: [rotationCard()],
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
    expect(screen.queryByRole("button", { name: "Excluir rotação Loop do Oberon" })).not.toBeInTheDocument();
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

  it("lets an admin confirm and delete a rotation", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    listCommunityRotations.mockResolvedValue({
      items: [rotationCard()],
      page: 1,
      limit: 12,
      total: 1,
      hasMore: false,
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter>
        <CommunityRotationsFeed />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Excluir rotação Loop do Oberon" }));
    await waitFor(() => expect(deleteCommunityRotation).toHaveBeenCalledWith("rot-1"));
    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByText("Rotação excluída.")).toBeInTheDocument();
    expect(screen.queryByText("Loop do Oberon")).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it("does not delete when the admin cancels confirmation", async () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    listCommunityRotations.mockResolvedValue({
      items: [rotationCard()],
      page: 1,
      limit: 12,
      total: 1,
      hasMore: false,
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <CommunityRotationsFeed />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Excluir rotação Loop do Oberon" }));
    expect(deleteCommunityRotation).not.toHaveBeenCalled();
    expect(screen.getByText("Loop do Oberon")).toBeInTheDocument();
    confirm.mockRestore();
  });
});
