import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PartiesPage } from "./PartiesPage";

vi.mock("../components/bosstiary/PartyPanel", () => ({
  PartyPanel: () => <div>Área própria de Partys</div>,
}));

describe("PartiesPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the dedicated party area accessible", () => {
    render(
      <MemoryRouter>
        <PartiesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Minhas Partys" })).toBeInTheDocument();
    expect(screen.getByText("Área própria de Partys")).toBeInTheDocument();
  });
});
