import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { describeGoogleError } from "./google-errors";
import { mountGoogleSignInButton } from "./google-identity";

type GoogleMock = {
  initialize: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  renderButton: ReturnType<typeof vi.fn>;
};

function installGoogle() {
  const googleId: GoogleMock = {
    initialize: vi.fn(),
    prompt: vi.fn(() => {
      throw new DOMException("signal is aborted without reason", "AbortError");
    }),
    renderButton: vi.fn(),
  };
  window.google = { accounts: { id: googleId } };
  return googleId;
}

function credentialCallback(googleId: GoogleMock) {
  const config = googleId.initialize.mock.calls[0]?.[0] as
    | { callback: (response: { credential?: string }) => void }
    | undefined;
  if (!config) throw new Error("Google initialize was not called");
  return config.callback;
}

describe("Google sign-in button flow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
    document.head.querySelectorAll("script").forEach((script) => script.remove());
    document.body.replaceChildren();
  });

  it("opens the account chooser through the Google button and never calls One Tap", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const googleId = installGoogle();
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    mountGoogleSignInButton(parent, { onCredential: vi.fn() });

    await vi.waitFor(() => expect(googleId.renderButton).toHaveBeenCalledOnce());
    expect(googleId.prompt).not.toHaveBeenCalled();
    expect(googleId.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "public-client-id",
        use_fedcm_for_button: false,
        auto_select: false,
      }),
    );
  });

  it("treats a FedCM abort as a cancellation and does not report a sign-in failure", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const googleId = installGoogle();
    const onCredential = vi.fn();
    const onFailure = vi.fn();
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    mountGoogleSignInButton(parent, { onCredential, onFailure });
    await vi.waitFor(() => expect(googleId.renderButton).toHaveBeenCalledOnce());

    expect(onCredential).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(describeGoogleError(new DOMException("signal is aborted without reason", "AbortError"))).toBe("");
  });

  it("ignores a second credential while the first sign-in is still in flight", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const googleId = installGoogle();
    let release: (() => void) | undefined;
    const onCredential = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    mountGoogleSignInButton(parent, { onCredential });
    await vi.waitFor(() => expect(googleId.initialize).toHaveBeenCalledOnce());

    const callback = credentialCallback(googleId);
    callback({ credential: "first-token" });
    callback({ credential: "second-token" });

    expect(onCredential).toHaveBeenCalledTimes(1);
    expect(onCredential).toHaveBeenCalledWith("first-token");
    release?.();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  });

  it("accepts a later credential after the first sign-in finishes", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const googleId = installGoogle();
    const onCredential = vi.fn().mockResolvedValue(undefined);
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    mountGoogleSignInButton(parent, { onCredential });
    await vi.waitFor(() => expect(googleId.initialize).toHaveBeenCalledOnce());
    const callback = credentialCallback(googleId);

    callback({ credential: "first-token" });
    await vi.waitFor(() => expect(onCredential).toHaveBeenCalledTimes(1));
    callback({ credential: "second-token" });
    await vi.waitFor(() => expect(onCredential).toHaveBeenCalledTimes(2));
  });

  it("drops a credential that arrives after the button is removed", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "public-client-id");
    const googleId = installGoogle();
    const onCredential = vi.fn();
    const parent = document.createElement("div");
    document.body.appendChild(parent);

    const mounted = mountGoogleSignInButton(parent, { onCredential });
    await vi.waitFor(() => expect(googleId.initialize).toHaveBeenCalledOnce());
    const callback = credentialCallback(googleId);
    mounted.cancel();
    callback({ credential: "late-token" });

    expect(onCredential).not.toHaveBeenCalled();
  });
});

describe("Google error copy", () => {
  it("hides cancellation and keeps API failures distinct", () => {
    expect(describeGoogleError(new Error("cancelled"))).toBe("");
    expect(describeGoogleError(new Error("unavailable"))).toMatch(/não carregou|não abriu/i);
    expect(
      describeGoogleError(new ApiError("HTTP_ERROR", 401, "Invalid Google credential", null)),
    ).toMatch(/validar o login/i);
    expect(
      describeGoogleError(
        new ApiError("HTTP_ERROR", 409, "Google sign-in is not linked to this account", null),
      ),
    ).toMatch(/senha/i);
  });
});
