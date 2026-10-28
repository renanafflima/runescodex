import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { BestiaryCreaturePage } from "./BestiaryCreaturePage";
import { BestiaryDetailPage } from "./BestiaryDetailPage";
import { BestiaryHuntsPage } from "./BestiaryHuntsPage";
import { BestiaryPage } from "./BestiaryPage";
import { HuntsPage } from "./HuntsPage";

const { listFilteredBestiary, listFilteredHunts, getBestiaryBySlug } = vi.hoisted(() => ({
  listFilteredBestiary: vi.fn(),
  listFilteredHunts: vi.fn(),
  getBestiaryBySlug: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isReady: true,
    isRosterReady: true,
    activeCharacter: null,
  }),
}));

vi.mock("../services/api/bestiary", () => ({
  listFilteredBestiary,
  getBestiaryBySlug,
}));

vi.mock("../services/api/hunts", () => ({
  listFilteredHunts,
}));

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
    listFilteredBestiary.mockReset();
    listFilteredHunts.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a bestiary API error instead of the empty catalog", async () => {
    listFilteredBestiary.mockRejectedValue(
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
    listFilteredBestiary.mockResolvedValue([]);

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
    listFilteredHunts.mockRejectedValue(
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
    listFilteredHunts.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <HuntsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhuma hunt encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("bestiary evolution and hunts screens", () => {
  beforeEach(() => {
    getBestiaryBySlug.mockReset();
    listFilteredHunts.mockReset();
    getBestiaryBySlug.mockResolvedValue(darkTorturer);
    listFilteredHunts.mockResolvedValue([prisonHunt]);
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
    expect(listFilteredHunts).toHaveBeenCalledWith({ creature: "dark-torturer" });
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
