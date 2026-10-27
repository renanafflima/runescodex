import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, DEVICE_LIMIT_MESSAGE } from "../services/api/errors";
import { LoginPage } from "./LoginPage";

const login = vi.hoisted(() => vi.fn());

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    status: "anonymous",
    user: null,
    login,
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
  }),
}));

vi.mock("../components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => null,
}));

describe("LoginPage device limit", () => {
  afterEach(() => {
    cleanup();
    login.mockReset();
  });

  it("shows the limit screen and does not list another account's devices", async () => {
    login.mockRejectedValue(new ApiError("HTTP_ERROR", 403, DEVICE_LIMIT_MESSAGE, { code: "DEVICE_LIMIT" }));
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Limite de equipamentos atingido" })).toBeInTheDocument();
    expect(screen.getByText(DEVICE_LIMIT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Chrome/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entender como funciona" }));
    expect(screen.getByText(/não pode ver nem remover os vínculos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao login" }));
    expect(screen.getByRole("heading", { name: "Entrar na sua conta" })).toBeInTheDocument();
  });
});
