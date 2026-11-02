import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HuntDetailPage } from "./HuntDetailPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ activeCharacter: null }),
}));

vi.mock("../hooks/useLatestRequest", () => ({
  useLatestRequest: () => ({
    start: () => () => true,
  }),
}));

vi.mock("../services/api/hunts", () => ({
  getHuntBySlug: vi.fn(),
}));

vi.mock("../services/api/admin-portal", () => ({
  recordContentView: vi.fn(),
}));

const { getHuntBySlug } = await import("../services/api/hunts");

describe("HuntDetailPage attention", () => {
  beforeEach(() => {
    vi.mocked(getHuntBySlug).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the attention notice when the API returns text", async () => {
    vi.mocked(getHuntBySlug).mockResolvedValueOnce({
      id: "h1",
      slug: "asura-palace",
      name: "Asura Palace",
      location: "Port Hope",
      vocations: [],
      attention: "PK frequente na entrada.",
      creatures: [],
    });

    render(
      <MemoryRouter initialEntries={["/hunts/asura-palace"]}>
        <Routes>
          <Route path="/hunts/:slug" element={<HuntDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("PK frequente na entrada.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveClass("hunt-detail__attention");
  });

  it("hides the attention notice when the field is empty", async () => {
    vi.mocked(getHuntBySlug).mockResolvedValueOnce({
      id: "h2",
      slug: "cyclops",
      name: "Cyclops",
      location: "Thais",
      vocations: [],
      attention: "   ",
      creatures: [],
    });

    render(
      <MemoryRouter initialEntries={["/hunts/cyclops"]}>
        <Routes>
          <Route path="/hunts/:slug" element={<HuntDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Cyclops" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });
  });
});
