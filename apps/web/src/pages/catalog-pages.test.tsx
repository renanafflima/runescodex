import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { BestiaryCreaturePage } from "./BestiaryCreaturePage";
import { BestiaryDetailPage } from "./BestiaryDetailPage";
import { BestiaryHuntsPage } from "./BestiaryHuntsPage";
import { BestiaryPage } from "./BestiaryPage";
import { HuntsPage } from "./HuntsPage";

const { listBestiaryPage, listHuntsPage, getBestiaryBySlug } = vi.hoisted(() => ({
  listBestiaryPage: vi.fn(),
  listHuntsPage: vi.fn(),
  getBestiaryBySlug: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isReady: true,
  isRosterReady: true,
  characters: [] as Array<{ id: string; name: string; vocation: string; level: number; world: string }>,
  activeCharacter: null as { id: string; name: string; vocation: string; level: number; world: string } | null,
  setActiveCharacter: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../services/api/bestiary", () => ({
  listBestiaryPage,
  getBestiaryBySlug,
}));

vi.mock("../services/api/hunts", () => ({
  listHuntsPage,
}));

function pageResult<T>(items: T[], extras: { page?: number; hasMore?: boolean; total?: number } = {}) {
  return {
    items,
    page: extras.page ?? 1,
    limit: 50,
    total: extras.total ?? items.length,
    hasMore: extras.hasMore ?? false,
  };
}

function renderBestiaryCreature(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/bestiary/:slug" element={<BestiaryCreaturePage />}>
          <Route index element={<BestiaryDetailPage />} />
          <Route path="hunts" element={<BestiaryHuntsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const darkTorturer = {
  id: "c1",
  name: "Dark Torturer",
  slug: "dark-torturer",
  image: "Dark_Torturer.gif",
  charmPoints: 50,
  killsRequired: 2500,
  estimatedHours: 4,
  locations: [{ name: "Roshamuul", region: "Roshamuul" }],
  together: [{ name: "Hellhound", slug: "hellhound" }],
  elements: [],
};

const prisonHunt = {
  id: "h1",
  name: "Roshamuul Prison -2",
  slug: "roshamuul-prison-2",
  location: "Roshamuul",
  vocations: [{ vocation: "EK", isRecommended: true, levelMin: 450, xpPerHour: 4500000, profitPerHour: 700000 }],
  creatures: [
    { name: "Dark Torturer", slug: "dark-torturer", isPrimary: true },
    { name: "Hellhound", slug: "hellhound", isPrimary: false },
  ],
};

describe("catalog pages distinguish empty data from API errors", () => {
  beforeEach(() => {
    listBestiaryPage.mockReset();
    listHuntsPage.mockReset();
    auth.isAuthenticated = false;
    auth.activeCharacter = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a bestiary API error instead of the empty catalog", async () => {
    listBestiaryPage.mockRejectedValue(
      new ApiError("HTTP_ERROR", 500, "Internal server error", null),
    );

    render(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro temporário no servidor");
    expect(screen.queryByText("Nenhuma criatura encontrada")).not.toBeInTheDocument();
  });

  it("shows an empty bestiary when the API returns no creatures", async () => {
    listBestiaryPage.mockResolvedValue(pageResult([]));

    render(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhuma criatura encontrada")).toBeInTheDocument();
    expect(screen.getByText(/Não há criaturas para este filtro/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a hunts API error instead of the empty catalog", async () => {
    listHuntsPage.mockRejectedValue(
      new ApiError("HTTP_ERROR", 500, "Internal server error", null),
    );

    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro temporário no servidor");
    expect(screen.queryByText("Nenhuma hunt encontrada")).not.toBeInTheDocument();
  });

  it("shows an empty hunt list when the API returns no hunts", async () => {
    listHuntsPage.mockResolvedValue(pageResult([]));

    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhuma hunt encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("catalog pages load a single page", () => {
  beforeEach(() => {
    listBestiaryPage.mockReset();
    listHuntsPage.mockReset();
    auth.activeCharacter = { id: "char-1", name: "Arvandor", vocation: "EK", level: 400, world: "Belobra" };
    auth.isAuthenticated = true;
  });

  afterEach(() => {
    cleanup();
  });

  it("asks hunts for the first page with vocation and level", async () => {
    listHuntsPage.mockResolvedValue(pageResult([prisonHunt], { hasMore: true, total: 80 }));

    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Roshamuul Prison -2")).toBeInTheDocument();
    expect(listHuntsPage).toHaveBeenCalledTimes(1);
    expect(listHuntsPage).toHaveBeenCalledWith({
      vocation: "EK",
      level: 400,
      page: 1,
      limit: 50,
    });
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
  });

  it("loads the next hunts page only when requested", async () => {
    listHuntsPage
      .mockResolvedValueOnce(pageResult([prisonHunt], { hasMore: true, total: 2 }))
      .mockResolvedValueOnce(
        pageResult(
          [{ ...prisonHunt, id: "h2", slug: "other-hunt", name: "Other Hunt" }],
          { page: 2, hasMore: false, total: 2 },
        ),
      );

    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Roshamuul Prison -2")).toBeInTheDocument();
    screen.getByRole("button", { name: "Carregar mais" }).click();
    expect(await screen.findByText("Other Hunt")).toBeInTheDocument();
    expect(listHuntsPage).toHaveBeenNthCalledWith(2, {
      vocation: "EK",
      level: 400,
      page: 2,
      limit: 50,
    });
  });

  it("sends hunt search to the API after debounce", async () => {
    listHuntsPage.mockResolvedValue(pageResult([]));
    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByPlaceholderText("Buscar hunt, criatura ou local"), {
      target: { value: "prison" },
    });
    await waitFor(() => {
      expect(listHuntsPage.mock.calls.some((call) => call[0]?.search === "prison")).toBe(true);
    });
  });

  it("does not keep a slower hunts response from a previous character", async () => {
    const rpHunt = {
      ...prisonHunt,
      id: "h-rp",
      slug: "rp-hunt",
      name: "RP Hunt",
      vocations: [{ vocation: "RP", isRecommended: true, levelMin: 100, xpPerHour: 1, profitPerHour: 1 }],
    };
    let finishEk: ((value: unknown) => void) | undefined;
    listHuntsPage.mockImplementation((query: { vocation?: string }) => {
      if (query.vocation === "EK") {
        return new Promise((resolve) => {
          finishEk = resolve;
        });
      }
      return Promise.resolve(pageResult([rpHunt]));
    });
    const { rerender } = render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    auth.activeCharacter = { id: "char-2", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" };
    rerender(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("RP Hunt")).toBeInTheDocument();
    finishEk?.(pageResult([{ ...prisonHunt, name: "EK Hunt", slug: "ek-hunt" }]));
    await waitFor(() => expect(screen.queryByText("EK Hunt")).not.toBeInTheDocument());
    expect(screen.getByText("RP Hunt")).toBeInTheDocument();
  });

  it("reloads hunts once when the active character changes", async () => {
    const rpHunt = {
      ...prisonHunt,
      id: "h-rp",
      slug: "rp-hunt",
      name: "RP Hunt",
      vocations: [{ vocation: "RP", isRecommended: true, levelMin: 100, xpPerHour: 1, profitPerHour: 1 }],
    };
    listHuntsPage.mockImplementation((query: { vocation?: string }) =>
      Promise.resolve(pageResult([query.vocation === "RP" ? rpHunt : prisonHunt])),
    );
    const { rerender } = render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Roshamuul Prison -2")).toBeInTheDocument();
    auth.activeCharacter = { id: "char-2", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" };
    rerender(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("RP Hunt")).toBeInTheDocument();
    expect(listHuntsPage).toHaveBeenCalledTimes(2);
    expect(listHuntsPage).toHaveBeenLastCalledWith({
      vocation: "RP",
      level: 150,
      page: 1,
      limit: 50,
    });
  });

  it("asks the bestiary API for search, difficulty and character without loading hunts", async () => {
    listBestiaryPage.mockResolvedValue(
      pageResult([{ ...darkTorturer, difficulty: "HARD" }], { hasMore: true, total: 90 }),
    );

    render(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    expect(listHuntsPage).not.toHaveBeenCalled();
    expect(listBestiaryPage).toHaveBeenCalledTimes(1);
    expect(listBestiaryPage).toHaveBeenCalledWith(
      {
        vocation: "EK",
        level: 400,
        page: 1,
        limit: 50,
      },
      true,
    );
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
  });

  it("sends bestiary search and difficulty to the API", async () => {
    listBestiaryPage.mockResolvedValue(pageResult([darkTorturer]));
    render(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar criatura, local ou grupo"), {
      target: { value: "torturer" },
    });
    await waitFor(() => {
      expect(listBestiaryPage).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulty: "HARD",
          search: "torturer",
          vocation: "EK",
          level: 400,
          page: 1,
          limit: 50,
        }),
        true,
      );
    });
  });

  it("loads more bestiary pages on demand and does not fetch hunts when the character changes", async () => {
    listBestiaryPage
      .mockResolvedValueOnce(pageResult([darkTorturer], { hasMore: true, total: 2 }))
      .mockResolvedValueOnce(
        pageResult([{ ...darkTorturer, id: "c2", name: "Hellhound", slug: "hellhound" }], {
          page: 2,
          hasMore: false,
          total: 2,
        }),
      )
      .mockResolvedValue(pageResult([darkTorturer]));

    const { rerender } = render(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Hellhound" })).toBeInTheDocument();
    expect(listBestiaryPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, limit: 50, vocation: "EK", level: 400 }),
      true,
    );

    auth.activeCharacter = { id: "char-2", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" };
    rerender(
      <MemoryRouter>
        <BestiaryPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(listBestiaryPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ vocation: "RP", level: 150, page: 1, limit: 50 }),
        true,
      );
    });
    expect(listHuntsPage).not.toHaveBeenCalled();
  });
});

describe("bestiary evolution and hunts screens", () => {
  beforeEach(() => {
    getBestiaryBySlug.mockReset();
    listHuntsPage.mockReset();
    getBestiaryBySlug.mockResolvedValue(darkTorturer);
    listHuntsPage.mockResolvedValue(pageResult([prisonHunt]));
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the evolution path with the selected creature and real hunts", async () => {
    renderBestiaryCreature("/bestiary/dark-torturer");

    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    expect(screen.getByText("Rota recomendada")).toBeInTheDocument();
    expect(screen.getByText("Roshamuul Prison -2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a hunt" })).toHaveAttribute(
      "href",
      "/hunts/roshamuul-prison-2",
    );
    expect(listHuntsPage).toHaveBeenCalledWith({
      creature: "dark-torturer",
      page: 1,
      limit: 50,
    });
  });

  it("does not refetch the creature when only the active character changes", async () => {
    auth.activeCharacter = { id: "char-1", name: "Arvandor", vocation: "EK", level: 400, world: "Belobra" };
    const { rerender } = render(
      <MemoryRouter initialEntries={["/bestiary/dark-torturer"]}>
        <Routes>
          <Route path="/bestiary/:slug" element={<BestiaryCreaturePage />}>
            <Route index element={<BestiaryDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    expect(getBestiaryBySlug).toHaveBeenCalledTimes(1);
    expect(listHuntsPage).toHaveBeenCalledTimes(1);

    auth.activeCharacter = { id: "char-2", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" };
    rerender(
      <MemoryRouter initialEntries={["/bestiary/dark-torturer"]}>
        <Routes>
          <Route path="/bestiary/:slug" element={<BestiaryCreaturePage />}>
            <Route index element={<BestiaryDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    expect(getBestiaryBySlug).toHaveBeenCalledTimes(1);
    expect(listHuntsPage).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected creature when opening all hunts", async () => {
    renderBestiaryCreature("/bestiary/dark-torturer/hunts");

    expect(await screen.findByRole("heading", { name: "Dark Torturer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Todas as hunts do Dark Torturer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para a hunt →" })).toHaveAttribute(
      "href",
      "/hunts/roshamuul-prison-2",
    );
    expect(screen.getByRole("link", { name: "Rotas recomendadas" })).toHaveAttribute(
      "href",
      "/bestiary/dark-torturer",
    );
  });
});
