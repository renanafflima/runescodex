import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./GoogleSignInButton";

describe("GoogleSignInButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    delete window.google;
  });

  it("explains that Google sign-in is not configured when the public client id is missing", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const onCredential = vi.fn();

    render(<GoogleSignInButton onCredential={onCredential} />);

    const button = document.querySelector("button");
    expect(button).toBeDisabled();
    expect(button?.textContent).toMatch(/Continuar com Google/);
    expect(screenText()).toMatch(/não está configurado neste ambiente/);
    expect(screenText()).not.toMatch(/client_secret|apps\.googleusercontent\.com/);
    expect(onCredential).not.toHaveBeenCalled();
  });

  it("does not surface an error when the account chooser is dismissed", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const prompt = vi.fn();
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton, prompt } as never } };
    const onCredential = vi.fn();
    const onError = vi.fn();

    render(<GoogleSignInButton onCredential={onCredential} onError={onError} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalledOnce());
    expect(prompt).not.toHaveBeenCalled();
    expect(onCredential).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(screenText()).not.toMatch(/não abriu a seleção/i);
  });

  it("sends only the first credential while sign-in is in flight", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const initialize = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton: vi.fn(),
        },
      },
    };
    let release: (() => void) | undefined;
    const onCredential = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const onError = vi.fn();

    render(<GoogleSignInButton onCredential={onCredential} onError={onError} />);
    await waitFor(() => expect(initialize).toHaveBeenCalledOnce());

    const config = initialize.mock.calls[0]?.[0] as
      | { callback: (response: { credential: string }) => void }
      | undefined;
    if (!config) throw new Error("Google initialize was not called");
    const callback = config.callback;
    callback({ credential: "first-token" });
    callback({ credential: "second-token" });

    expect(onCredential).toHaveBeenCalledTimes(1);
    expect(onCredential).toHaveBeenCalledWith("first-token");
    expect(onError).not.toHaveBeenCalled();
    release?.();
  });
});

function screenText() {
  return document.body.textContent ?? "";
}
