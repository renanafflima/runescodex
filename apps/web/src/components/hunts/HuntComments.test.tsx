import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api/errors";
import type { HuntCommentPage } from "../../services/api/hunt-comments";
import { HuntComments } from "./HuntComments";

const api = vi.hoisted(() => ({
  listHuntComments: vi.fn(),
  createHuntComment: vi.fn(),
  updateHuntComment: vi.fn(),
  deleteHuntComment: vi.fn(),
  likeHuntComment: vi.fn(),
  unlikeHuntComment: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as { id: string } | null,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../../services/api/hunt-comments", () => api);

const page: HuntCommentPage = {
  items: [
    {
      id: "c1",
      content: "Boa hunt",
      isEdited: true,
      isDeleted: false,
      createdAt: "2026-10-05T12:00:00.000Z",
      updatedAt: "2026-10-05T12:00:00.000Z",
      user: { id: "user-a", name: "Renan" },
      likesCount: 2,
      likedByMe: false,
      replies: [
        {
          id: "r1",
          content: "Concordo",
          isEdited: false,
          isDeleted: false,
          createdAt: "2026-10-05T12:05:00.000Z",
          updatedAt: "2026-10-05T12:05:00.000Z",
          user: { id: "user-b", name: "Ana" },
          likesCount: 0,
          likedByMe: true,
          replies: [],
        },
      ],
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  hasMore: false,
  commentCount: 2,
};

function renderComments() {
  return render(
    <MemoryRouter>
      <HuntComments slug="cyclops" />
    </MemoryRouter>,
  );
}

describe("HuntComments", () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.user = null;
    api.listHuntComments.mockReset();
    api.createHuntComment.mockReset();
    api.updateHuntComment.mockReset();
    api.deleteHuntComment.mockReset();
    api.likeHuntComment.mockReset();
    api.unlikeHuntComment.mockReset();
    api.listHuntComments.mockResolvedValue(page);
    api.createHuntComment.mockResolvedValue(page.items[0]);
    api.updateHuntComment.mockResolvedValue(page.items[0]);
    api.deleteHuntComment.mockResolvedValue(page.items[0]);
    api.likeHuntComment.mockResolvedValue({ commentId: "c1", likesCount: 3, likedByMe: true });
    api.unlikeHuntComment.mockResolvedValue({ commentId: "r1", likesCount: 0, likedByMe: false });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows comments, an edited flag, and a reply", async () => {
    renderComments();
    expect(await screen.findByText("Boa hunt")).toBeInTheDocument();
    expect(screen.getByText("Concordo")).toBeInTheDocument();
    expect(screen.getByText("editado")).toBeInTheDocument();
    expect(screen.getByText("2 comentários")).toBeInTheDocument();
  });

  it("shows an empty list when the API returns no comments", async () => {
    api.listHuntComments.mockResolvedValue({ ...page, items: [], total: 0, commentCount: 0 });
    renderComments();
    expect(await screen.findByText("Nenhum comentário.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an API error instead of an empty list", async () => {
    api.listHuntComments.mockRejectedValue(new ApiError("HTTP_ERROR", 500, "Internal server error", null));
    renderComments();
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(screen.queryByText("Nenhum comentário.")).not.toBeInTheDocument();
  });

  it("asks a logged-out visitor to sign in and hides the composer", async () => {
    renderComments();
    expect(await screen.findByText(/Entre na sua conta para comentar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("lets a logged-in author comment, edit, delete, reply, like, and unlike", async () => {
    auth.isAuthenticated = true;
    auth.user = { id: "user-a" };
    renderComments();

    expect(await screen.findByRole("button", { name: "Comentar" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Escreva um comentário..."), {
      target: { value: "Nova mensagem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(api.createHuntComment).toHaveBeenCalledWith("cyclops", "Nova mensagem"));

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Editar comentário"), { target: { value: "Texto novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.updateHuntComment).toHaveBeenCalledWith("cyclops", "c1", "Texto novo"));

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(api.deleteHuntComment).toHaveBeenCalledWith("cyclops", "c1"));

    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    fireEvent.change(screen.getByPlaceholderText("Escreva uma resposta..."), {
      target: { value: "Uma resposta" },
    });
    const replySubmit = screen.getAllByRole("button", { name: "Responder" })[1];
    if (!replySubmit) {
      throw new Error("Botão de enviar resposta não encontrado");
    }
    fireEvent.click(replySubmit);
    await waitFor(() => expect(api.createHuntComment).toHaveBeenCalledWith("cyclops", "Uma resposta", "c1"));

    fireEvent.click(screen.getByRole("button", { name: /^Curtir/ }));
    await waitFor(() => expect(api.likeHuntComment).toHaveBeenCalledWith("cyclops", "c1"));

    fireEvent.click(screen.getByRole("button", { name: /^Descurtir/ }));
    await waitFor(() => expect(api.unlikeHuntComment).toHaveBeenCalledWith("cyclops", "r1"));
  });

  it("disables the submit button while the comment is being sent", async () => {
    auth.isAuthenticated = true;
    auth.user = { id: "user-a" };
    let release: () => void = () => undefined;
    api.createHuntComment.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(page.items[0]);
        }),
    );
    renderComments();
    fireEvent.change(await screen.findByPlaceholderText("Escreva um comentário..."), {
      target: { value: "Aguarde" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Comentar/ })).toBeDisabled());
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Comentar" })).toBeEnabled());
  });
});
