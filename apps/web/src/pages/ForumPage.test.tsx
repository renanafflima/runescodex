import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { ForumComposePage } from "./ForumComposePage";
import { ForumPage } from "./ForumPage";
import { ForumThreadPage } from "./ForumThreadPage";

const { listForumThreads, createForumThread, getForumThread } = vi.hoisted(() => ({
  listForumThreads: vi.fn(),
  createForumThread: vi.fn(),
  getForumThread: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: true,
  user: null as { id: string } | null,
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../services/api/forum", () => ({
  listForumThreads,
  createForumThread,
  getForumThread,
  createForumReply: vi.fn(),
  closeForumThread: vi.fn(),
}));

const thread = {
  id: "thread-1",
  title: "Qual hunt vocês recomendam para esse level?",
  body: "Estou procurando uma opção com bom equilíbrio entre XP/h e profit.",
  category: "HUNTS",
  status: "open",
  createdAt: "2026-10-09T12:00:00.000Z",
  author: { id: "user-1" },
  createdByUserId: "user-1",
  replyCount: 8,
  comments: [],
};

function renderForum(path = "/forum") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/forum/new" element={<ForumComposePage />} />
        <Route path="/forum/:id" element={<ForumThreadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("forum pages", () => {
  beforeEach(() => {
    listForumThreads.mockReset();
    createForumThread.mockReset();
    getForumThread.mockReset();
    auth.isAuthenticated = false;
    auth.user = null;
    listForumThreads.mockResolvedValue({
      items: [thread],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("lists real discussions with category, author and replies", async () => {
    renderForum();

    const links = await screen.findAllByRole("link", { name: /Qual hunt vocês recomendam/ });
    expect(links[0]).toHaveAttribute("href", "/forum/thread-1");
    expect(screen.getByText("por Aventureiro · user-1")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("filters by category through the API", async () => {
    renderForum();
    await screen.findAllByRole("link", { name: /Qual hunt vocês recomendam/ });

    fireEvent.click(screen.getByRole("button", { name: /Hunts/i }));

    await waitFor(() =>
      expect(listForumThreads).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "HUNTS" }),
      ),
    );
  });

  it("searches through the API", async () => {
    renderForum();
    await screen.findAllByRole("link", { name: /Qual hunt vocês recomendam/ });

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "profit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));

    await waitFor(() =>
      expect(listForumThreads).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "profit" }),
      ),
    );
  });

  it("shows an API error instead of the empty list", async () => {
    listForumThreads.mockRejectedValue(new ApiError("NETWORK", 0, "NETWORK", null));
    renderForum();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar à API");
    expect(screen.queryByText("Nenhuma discussão encontrada")).not.toBeInTheDocument();
  });

  it("shows an empty state when the API returns no discussions", async () => {
    listForumThreads.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    });
    renderForum();

    expect(await screen.findByText("Nenhuma discussão encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("validates the compose form and keeps the draft after an API error", async () => {
    auth.isAuthenticated = true;
    auth.user = { id: "user-1" };
    createForumThread.mockRejectedValue(new ApiError("HTTP_ERROR", 400, "Dados inválidos.", null));

    renderForum("/forum/new");

    fireEvent.click(screen.getByRole("button", { name: "Publicar discussão" }));
    expect(screen.getByText("Informe um título objetivo para a discussão.")).toBeInTheDocument();
    expect(createForumThread).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Qual hunt vocês recomendam?" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "HUNTS" } });
    fireEvent.change(screen.getByLabelText("Conteúdo"), {
      target: { value: "Estou no 200 EK e quero XP com algum profit." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar discussão" }));

    expect(await screen.findByText("Não foi possível publicar")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Qual hunt vocês recomendam?");
    expect(createForumThread).toHaveBeenCalledWith({
      title: "Qual hunt vocês recomendam?",
      body: "Estou no 200 EK e quero XP com algum profit.",
      category: "HUNTS",
    });
  });

  it("publishes a valid discussion and opens the created thread", async () => {
    auth.isAuthenticated = true;
    auth.user = { id: "user-1" };
    createForumThread.mockResolvedValue(thread);
    getForumThread.mockResolvedValue(thread);

    renderForum("/forum/new");

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Qual hunt vocês recomendam?" },
    });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "HUNTS" } });
    fireEvent.change(screen.getByLabelText("Conteúdo"), {
      target: { value: "Estou no 200 EK e quero XP com algum profit." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar discussão" }));

    expect(await screen.findByRole("heading", { name: thread.title })).toBeInTheDocument();
    expect(await screen.findByText("Discussão publicada")).toBeInTheDocument();
  });
});
