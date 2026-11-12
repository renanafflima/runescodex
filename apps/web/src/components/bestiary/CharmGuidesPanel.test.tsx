import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CharmGuidesPanel } from "./CharmGuidesPanel";

const api = vi.hoisted(() => ({
  getCharmGuideCategories: vi.fn(),
  listCharmGuides: vi.fn(),
}));

vi.mock("../../services/api/charm-guides", () => ({
  getCharmGuideCategories: api.getCharmGuideCategories,
  listCharmGuides: api.listCharmGuides,
}));

const GUIDE_ID = "dcb317c3-78ae-49f8-98c7-25e4d5313a41";

describe("CharmGuidesPanel", () => {
  const onPublish = vi.fn();

  beforeEach(() => {
    onPublish.mockReset();
    api.getCharmGuideCategories.mockResolvedValue({
      categories: [{ cpCategory: "CP_100", guideCount: 1 }],
    });
    api.listCharmGuides.mockResolvedValue({
      items: [
        {
          id: GUIDE_ID,
          title: "Rota Banuta",
          description: "Charm rápido.",
          cpCategory: "CP_100",
          difficulty: "EASY",
          status: "PUBLISHED",
          totalCharmPoints: 100,
          uniqueCreatureCount: 3,
          stepCount: 2,
          likeCount: 4,
          favoriteCount: 1,
          commentCount: 0,
          likedByMe: false,
          favoritedByMe: false,
          publishedAt: "2026-11-12T12:00:00.000Z",
          createdAt: "2026-11-12T12:00:00.000Z",
          author: { id: "u1", name: "Renan" },
        },
      ],
      page: 1,
      limit: 3,
      total: 1,
      hasMore: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the share CTA and links to the full strategy", async () => {
    render(
      <MemoryRouter>
        <CharmGuidesPanel onPublish={onPublish} />
      </MemoryRouter>,
    );

    const share = await screen.findByRole("button", { name: "＋ Compartilhe sua estratégia" });
    fireEvent.click(share);
    expect(onPublish).toHaveBeenCalledTimes(1);

    const open = await screen.findByRole("link", { name: "Ver estratégia completa →" });
    expect(open).toHaveAttribute("href", `/bestiary/guides/${GUIDE_ID}`);
  });
});
