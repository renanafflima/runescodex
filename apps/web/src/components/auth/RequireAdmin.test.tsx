import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireAdmin } from "./RequireAdmin";

const auth = vi.hoisted(() => ({
  status: "authenticated" as "loading" | "anonymous" | "authenticated",
  isAuthenticated: true,
  user: null as { id: string; role?: string } | null,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

function show() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="/login" element={<h1>Login</h1>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <h1>Painel admin</h1>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  afterEach(() => {
    cleanup();
    auth.status = "authenticated";
    auth.isAuthenticated = true;
    auth.user = null;
  });

  it("blocks an anonymous visitor", () => {
    auth.status = "anonymous";
    auth.isAuthenticated = false;
    show();
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("blocks a regular USER", () => {
    auth.user = { id: "user-1", role: "USER" };
    show();
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
  });

  it("allows an ADMIN", () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    show();
    expect(screen.getByRole("heading", { name: "Painel admin" })).toBeInTheDocument();
  });
});
