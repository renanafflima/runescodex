import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { BestiaryPage } from "./BestiaryPage";
import { HuntsPage } from "./HuntsPage";

const { listFilteredBestiary, listFilteredHunts } = vi.hoisted(() => ({
  listFilteredBestiary: vi.fn(),
  listFilteredHunts: vi.fn(),
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
}));

vi.mock("../services/api/hunts", () => ({
  listFilteredHunts,
}));

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

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
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
    expect(screen.getByText(/não retornou criaturas/i)).toBeInTheDocument();
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

    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
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
