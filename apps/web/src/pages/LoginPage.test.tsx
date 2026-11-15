import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVICE_LIMIT_MESSAGE } from "../services/api/errors";
import { LoginPage } from "./LoginPage";

const loginWithGoogle = vi.hoisted(() => vi.fn());

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    status: "anonymous",
    user: null,
    loginWithGoogle,
  }),
}));

vi.mock("../components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: ({
    onError,
  }: {
    onError?: (message: string) => void;
  }) => (
    <button onClick={() => onError?.(DEVICE_LIMIT_MESSAGE)} type="button">
      Continuar com Google
    </button>
  ),
}));

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    loginWithGoogle.mockReset();
  });

  it("shows only Google access guidance", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Sua jornada começa com o Google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
    expect(screen.getByText(/Utilize sua conta Google para acessar o RuneCodex/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar conta" })).not.toBeInTheDocument();
  });

  it("shows the limit screen and does not list another account's devices", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    expect(await screen.findByRole("heading", { name: "Limite de equipamentos atingido" })).toBeInTheDocument();
    expect(screen.getByText(DEVICE_LIMIT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Chrome/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entender como funciona" }));
    expect(screen.getByText(/não pode ver nem remover os vínculos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao login" }));
    expect(screen.getByRole("heading", { name: /Sua jornada começa com o Google/i })).toBeInTheDocument();
  });
});