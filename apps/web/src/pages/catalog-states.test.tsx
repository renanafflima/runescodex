import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CatalogEmpty, CatalogError } from "../components/catalog/CatalogState";

describe("catalog UI states", () => {
  it("renders an empty state", () => {
    render(
      <CatalogEmpty
        description="A API não retornou hunts para os filtros atuais."
        title="Nenhuma hunt encontrada"
      />,
    );
    expect(screen.getByText("Nenhuma hunt encontrada")).toBeInTheDocument();
    expect(screen.getByText(/não retornou hunts/i)).toBeInTheDocument();
  });

  it("renders an error state with retry", () => {
    render(
      <MemoryRouter>
        <CatalogError description="Não foi possível conectar à API." onRetry={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});
