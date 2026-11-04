import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api/errors";
import { BosstiaryComments } from "./BosstiaryComments";

const api = vi.hoisted(() => ({
  listBosstiaryComments: vi.fn(),
  createBosstiaryComment: vi.fn(),
  updateBosstiaryComment: vi.fn(),
  deleteBosstiaryComment: vi.fn(),
  likeBosstiaryComment: vi.fn(),
  unlikeBosstiaryComment: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as { id: string } | null,
}));

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../services/api/bosstiary-comments", () => api);

describe("BosstiaryComments", () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.user = null;
    api.listBosstiaryComments.mockResolvedValue({
      items: [
        {
          id: "c1",
          content: "Bom boss",
          isEdited: true,
          isDeleted: false,
          createdAt: "2026-11-04T12:00:00.000Z",
          updatedAt: "2026-11-04T12:00:00.000Z",
          user: { id: "user-a", name: "Renan" },
          likesCount: 2,
          likedByMe: false,
          replies: [],
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
      commentCount: 1,
    });
    api.createBosstiaryComment.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps comments on the boss detail flow", async () => {
    render(
      <MemoryRouter>
        <BosstiaryComments slug="ferumbras" />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Bom boss")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comentários da comunidade" })).toBeInTheDocument();
  });

  it("shows an API error instead of an empty list", async () => {
    api.listBosstiaryComments.mockRejectedValue(new ApiError("HTTP_ERROR", 500, "Internal server error", null));
    render(
      <MemoryRouter>
        <BosstiaryComments slug="ferumbras" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Erro tempor.rio no servidor/);
  });

  it("lets a logged-in author comment", async () => {
    auth.isAuthenticated = true;
    auth.user = { id: "user-a" };
    render(
      <MemoryRouter>
        <BosstiaryComments slug="ferumbras" />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByPlaceholderText("Escreva um comentário..."), {
      target: { value: "Nova mensagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(api.createBosstiaryComment).toHaveBeenCalledWith("ferumbras", "Nova mensagem"));
  });
});
