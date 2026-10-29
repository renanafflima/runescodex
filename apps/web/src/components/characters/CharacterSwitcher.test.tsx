import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSwitcher } from "./CharacterSwitcher";

const auth = vi.hoisted(() => ({
  characters: [] as Array<{ id: string; name: string; vocation: string; level: number; world: string }>,
  activeCharacter: null as { id: string; name: string; vocation: string; level: number; world: string } | null,
  setActiveCharacter: vi.fn(),
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

describe("CharacterSwitcher", () => {
  afterEach(() => {
    cleanup();
    auth.characters = [];
    auth.activeCharacter = null;
    auth.setActiveCharacter.mockReset();
  });

  it("hides when the account has no characters", () => {
    render(<CharacterSwitcher />);
    expect(screen.queryByLabelText("Personagem principal")).not.toBeInTheDocument();
  });

  it("persists a new principal without requiring a new login", async () => {
    auth.characters = [
      { id: "char-1", name: "Arvandor", vocation: "EK", level: 400, world: "Belobra" },
      { id: "char-2", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" },
    ];
    const active = auth.characters[0];
    if (!active) throw new Error("Personagem ausente");
    auth.activeCharacter = active;
    render(<CharacterSwitcher />);

    fireEvent.change(screen.getByLabelText("Personagem principal"), { target: { value: "char-2" } });
    expect(auth.setActiveCharacter).toHaveBeenCalledWith("char-2");
  });
});
