import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeNews } from "./HomeNews";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as { premium?: { access: boolean } } | null,
}));

const listForumThreads = vi.hoisted(() => vi.fn());

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../../services/api/forum", () => ({
  listForumThreads: (...args: unknown[]) => listForumThreads(...args),
}));

describe("HomeNews", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.user = null;
    listForumThreads.mockReset();
  });

  it("keeps editorial cards when the visitor is anonymous", () => {
    render(
      <MemoryRouter>
        <HomeNews />
      </MemoryRouter>,
    );
    expect(listForumThreads).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Charm Guides no Bestiário/i })).toBeInTheDocument();
  });

  it("uses existing forum threads for premium users and falls back on error", async () => {
    auth.isAuthenticated = true;
    auth.user = { premium: { access: true } };
    listForumThreads.mockResolvedValueOnce({
      items: [
        {
          id: "thread-1",
          title: "Nova rota de Cyclops",
          body: "Detalhes da hunt.",
          status: "open",
          createdAt: new Date().toISOString(),
          author: { id: "u1" },
          replyCount: 4,
          comments: [],
        },
      ],
    });

    const { unmount } = render(
      <MemoryRouter>
        <HomeNews />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Nova rota de Cyclops/i })).toHaveAttribute(
        "href",
        "/forum/thread-1",
      );
    });
    unmount();

    listForumThreads.mockRejectedValueOnce(new Error("offline"));
    render(
      <MemoryRouter>
        <HomeNews />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Charm Guides no Bestiário/i })).toBeInTheDocument();
    });
  });
});
