import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BosstiaryEntry } from "../domain/bosstiary";
import { BosstiaryPage } from "./BosstiaryPage";

const { loadBosstiaryCatalog } = vi.hoisted(() => ({
  loadBosstiaryCatalog: vi.fn(),
}));

vi.mock("../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog,
}));

function entry(overrides: Partial<BosstiaryEntry> = {}): BosstiaryEntry {
  return {
    name: "Ferumbras",
    slug: "ferumbras",
    sourceUrl: "https://www.tibiawiki.com.br/wiki/Ferumbras",
    isboss: "sim",
    source: "tibiawiki-candidate",
    party: "solo",
    recommendedLevel: 300,
    imageUrl: "/ferumbras.gif",
    rewards: [],
    location: null,
    bossPoints: null,
    ...overrides,
  };
}

describe("BosstiaryPage", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    loadBosstiaryCatalog.mockReset();
    loadBosstiaryCatalog.mockReturnValue({
      skipped: 0,
      entries: [
        entry(),
        entry({
          name: "Ghazbaran",
          slug: "ghazbaran",
          sourceUrl: "https://www.tibiawiki.com.br/wiki/Ghazbaran",
          party: null,
          recommendedLevel: null,
          imageUrl: null,
        }),
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  function show() {
    render(
      <MemoryRouter>
        <BosstiaryPage />
      </MemoryRouter>,
    );
  }

  it("filters by name, solo and level, then opens the matching boss", () => {
    show();
    expect(screen.getByRole("button", { name: /Ferumbras/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ghazbaran/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar boss pelo nome"), { target: { value: "ghaz" } });
    expect(screen.queryByRole("button", { name: /Ferumbras/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ghazbaran/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar boss pelo nome"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    expect(screen.getByRole("button", { name: /Ferumbras/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ghazbaran/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "500" }));
    expect(screen.getByText("Nenhum boss encontrado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "300" }));
    fireEvent.click(screen.getByRole("button", { name: /Ferumbras/ }));
    expect(screen.getByRole("dialog", { name: "Ferumbras" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma recompensa cadastrada.")).toBeInTheDocument();
    expect(screen.getByText("Localização ainda não cadastrada.")).toBeInTheDocument();
    expect(screen.getByText("Sem fonte de Boss Points no RuneCodex.")).toBeInTheDocument();
  });

  it("shows the catalog error state", () => {
    loadBosstiaryCatalog.mockImplementation(() => {
      throw new Error("Lista ilegível");
    });
    show();
    expect(screen.getByText("Lista ilegível")).toBeInTheDocument();
  });
});
