import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPwaInstallSnapshot,
  resetPwaInstallService,
  type BeforeInstallPromptEvent,
} from "../pwa/install";
import { usePwaInstall } from "./usePwaInstall";

function installPromptEvent() {
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  Object.defineProperty(event, "preventDefault", {
    value: vi.fn(),
  });
  return event;
}

function StatusProbe({ label }: { label: string }) {
  const { status, showAction } = usePwaInstall();
  return (
    <div aria-label={label}>
      {showAction ? `action:${status}` : `hidden:${status}`}
    </div>
  );
}

describe("usePwaInstall shared store", () => {
  afterEach(() => {
    cleanup();
    resetPwaInstallService();
  });

  it("updates every mounted consumer when beforeinstallprompt fires after mount", () => {
    render(
      <>
        <StatusProbe label="home" />
        <StatusProbe label="header" />
        <StatusProbe label="nav" />
      </>,
    );

    expect(screen.getByLabelText("home")).toHaveTextContent("hidden:unsupported");

    act(() => {
      window.dispatchEvent(installPromptEvent());
    });

    expect(getPwaInstallSnapshot()).toBe("available");
    expect(screen.getByLabelText("home")).toHaveTextContent("action:available");
    expect(screen.getByLabelText("header")).toHaveTextContent("action:available");
    expect(screen.getByLabelText("nav")).toHaveTextContent("action:available");
  });

  it("updates every mounted consumer after appinstalled", () => {
    render(
      <>
        <StatusProbe label="a" />
        <StatusProbe label="b" />
      </>,
    );

    act(() => {
      window.dispatchEvent(installPromptEvent());
    });
    expect(screen.getByLabelText("a")).toHaveTextContent("action:available");
    expect(screen.getByLabelText("b")).toHaveTextContent("action:available");

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.getByLabelText("a")).toHaveTextContent("hidden:unsupported");
    expect(screen.getByLabelText("b")).toHaveTextContent("hidden:unsupported");
  });
});