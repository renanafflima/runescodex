import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { CharmGuideDetailPage } from "./CharmGuideDetailPage";

const api = vi.hoisted(() => ({
  getCharmGuide: vi.fn(),
  listCharmGuideComments: vi.fn(),
}));

vi.mock("../services/api/charm-guides", () => ({
  getCharmGuide: api.getCharmGuide,
  listCharmGuideComments: api.listCharmGuideComments,
  likeCharmGuide: vi.fn(),
  unlikeCharmGuide: vi.fn(),
  favoriteCharmGuide: vi.fn(),
  unfavoriteCharmGuide: vi.fn(),
  createCharmGuideComment: vi.fn(),
  updateCharmGuideProgress: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    activeCharacter: { id: "char-1" },
  }),
}));

const GUIDE_ID = "dcb317c3-78ae-49f8-98c7-25e4d5313a41";

function pendingGuide() {
  return {
    id: GUIDE_ID,
    title: "Teste21",
    description: "Guia enviado para análise.",
    cpCategory: "CP_100",
    difficulty: "EASY",
    status: "PENDING_REVIEW",
    totalCharmPoints: 65,
    uniqueCreatureCount: 2,
    stepCount: 1,
    likeCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    likedByMe: false,
    favoritedByMe: false,
    publishedAt: null,
    createdAt: "2026-11-12T00:00:00.000Z",
    author: { id: "owner", name: "Autor" },
    adminResponse: null,
    ticket: { id: "ticket-1", protocol: "RC-1", status: "OPEN" },
    steps: [
      {
        id: "step-1",
        position: 1,
        title: "Etapa 1",
        notes: null,
        hunt: null,
        creatures: [
          {
            id: "c1",
            slug: "dragon",
            name: "Dragon",
            image: "",
            difficulty: "MEDIUM",
            charmPoints: 25,
            countsTowardTotal: true,
            repeatedFromEarlierStep: false,
            completed: false,
          },
        ],
      },
    ],
    progress: { completedCreatureIds: [] },
  };
}

function renderDetail(id = GUIDE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/bestiary/guides/${id}`]}>
      <Routes>
        <Route path="/bestiary/guides/:id" element={<CharmGuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CharmGuideDetailPage", () => {
  afterEach(() => {
    cleanup();
    api.getCharmGuide.mockReset();
    api.listCharmGuideComments.mockReset();
  });

  it("shows a pending guide for the author without calling comments", async () => {
    api.getCharmGuide.mockResolvedValue(pendingGuide());
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Teste21" })).toBeInTheDocument();
    expect(screen.getByText(/está em análise/)).toBeInTheDocument();
    expect(screen.getByText("Dragon")).toBeInTheDocument();
    expect(api.listCharmGuideComments).not.toHaveBeenCalled();
  });

  it("still renders the guide if comments 404 after a published load", async () => {
    api.getCharmGuide.mockResolvedValue({ ...pendingGuide(), status: "PUBLISHED" });
    api.listCharmGuideComments.mockRejectedValue(
      new ApiError("HTTP_ERROR", 404, "Guia não encontrado.", { message: "Guia não encontrado." }),
    );
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Teste21" })).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });

  it("shows not found when the detail endpoint 404s", async () => {
    api.getCharmGuide.mockRejectedValue(
      new ApiError("HTTP_ERROR", 404, "Guia não encontrado.", { message: "Guia não encontrado." }),
    );
    renderDetail("11111111-1111-4111-8111-111111111111");
    expect(await screen.findByText(/Guia não encontrado/)).toBeInTheDocument();
  });

  it("requests the route param as the guide id", async () => {
    api.getCharmGuide.mockResolvedValue(pendingGuide());
    renderDetail();
    await waitFor(() => {
      expect(api.getCharmGuide).toHaveBeenCalledWith(GUIDE_ID, "char-1");
    });
  });

  it("resolves creature art from slug when the API returns a raw path", async () => {
    const guide = pendingGuide();
    guide.steps[0]!.creatures[0] = {
      id: "c1",
      slug: "cyclops",
      name: "Cyclops",
      image: "Cyclops.gif",
      difficulty: "EASY",
      charmPoints: 5,
      countsTowardTotal: true,
      repeatedFromEarlierStep: false,
      completed: false,
    };
    api.getCharmGuide.mockResolvedValue(guide);
    renderDetail();
    expect(await screen.findByText("Cyclops")).toBeInTheDocument();
    const image = document.querySelector(".charm-guide-creature__art");
    expect(image).toHaveAttribute("src", expect.stringContaining("Cyclops.gif"));
  });
});
