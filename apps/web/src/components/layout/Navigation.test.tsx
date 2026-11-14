import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetPwaInstallService,
  startPwaInstallService,
  type BeforeInstallPromptEvent,
} from "../../pwa/install";
import { Navigation } from "./Navigation";

const auth = vi.hoisted(() => ({
  user: null as { id: string; role?: string } | null,
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

describe("Navigation admin entry", () => {
  it("hides hunt requests from a regular user", () => {
    auth.user = { id: "user-1", role: "USER" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Partys" })).toHaveAttribute("href", "/bosstiary/parties");
  });

  it("shows the administration portal to an administrator", () => {
    auth.user = { id: "admin-1", role: "ADMIN" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute("href", "/admin");
  });

  it("adds a permanent install action when the native prompt is available", () => {
    startPwaInstallService();
    const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
    event.prompt = vi.fn(async () => undefined);
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);

    auth.user = { id: "user-1", role: "USER" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Instalar app" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hunts" })).toHaveAttribute("href", "/hunts");
  });

  it("shows the install action when beforeinstallprompt arrives after navigation mounts", () => {
    resetPwaInstallService();
    startPwaInstallService();

    auth.user = { id: "user-1", role: "USER" };
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();

    const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
    event.prompt = vi.fn(async () => undefined);
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    Object.defineProperty(event, "preventDefault", { value: vi.fn() });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.getByRole("button", { name: "Instalar app" })).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  resetPwaInstallService();
});
