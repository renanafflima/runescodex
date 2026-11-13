import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRotationPublishModal } from "./CommunityRotationPublishModal";

const { createCommunityRotation, listMyParties } = vi.hoisted(() => ({
  createCommunityRotation: vi.fn(),
  listMyParties: vi.fn(),
}));

vi.mock("../../services/api/community-rotations", () => ({
  createCommunityRotation,
}));

vi.mock("../../services/api/parties", () => ({
  listMyParties,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    activeCharacter: { vocation: "EK" },
  }),
}));

vi.mock("../../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog: () => ({ entries: [] }),
  searchBosstiaryCatalog: () => [],
}));

describe("CommunityRotationPublishModal", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    createCommunityRotation.mockReset();
    listMyParties.mockReset();
    createCommunityRotation.mockResolvedValue({ id: "rot-1" });
    listMyParties.mockResolvedValue({
      items: [
        {
          id: "party-1",
          name: "Party de Bosses",
          memberCount: 4,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
  });

  afterEach(() => cleanup());

  it("publishes a private diary rotation without a party", async () => {
    const onPublished = vi.fn();
    render(
      <MemoryRouter>
        <CommunityRotationPublishModal onClose={() => undefined} onPublished={onPublished} open />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Ferumbras e Orshabaal" } });
    fireEvent.click(screen.getByRole("radio", { name: /Meu diário privado/i }));
    fireEvent.change(screen.getByLabelText("Buscar boss"), { target: { value: "Ferumbras" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar nome" }));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar rotação" }));

    await waitFor(() => expect(createCommunityRotation).toHaveBeenCalled());
    const privatePayload = createCommunityRotation.mock.calls[0]?.[0];
    expect(privatePayload).toMatchObject({
      title: "Ferumbras e Orshabaal",
      visibility: "PRIVATE",
    });
    expect(privatePayload?.partyId).toBeUndefined();
  });

  it("shares the same form with a selected party", async () => {
    render(
      <MemoryRouter>
        <CommunityRotationPublishModal
          defaultPartyId="party-1"
          onClose={() => undefined}
          onPublished={vi.fn()}
          open
        />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Party")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Rota da Party" } });
    fireEvent.change(screen.getByLabelText("Buscar boss"), { target: { value: "Orshabaal" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar nome" }));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar rotação" }));

    await waitFor(() => expect(createCommunityRotation).toHaveBeenCalled());
    expect(createCommunityRotation.mock.calls[0]?.[0]).toMatchObject({
      visibility: "GROUP",
      partyId: "party-1",
    });
  });
});
