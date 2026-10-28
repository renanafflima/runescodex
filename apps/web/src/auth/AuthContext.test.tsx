import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { getAccessToken, setAccessToken } from "../services/session";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  loginUser: vi.fn(),
  listCharacters: vi.fn(),
  getActiveCharacter: vi.fn(),
}));

vi.mock("../services/api/devices", () => ({
  withDeviceProof: (request: (device: object) => Promise<unknown>) =>
    request({ installationId: "test" }),
}));

vi.mock("../services/api/auth", () => ({
  fetchMe: mocks.fetchMe,
  loginUser: mocks.loginUser,
  loginWithGoogle: vi.fn(),
  linkGoogleAccount: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}));

vi.mock("../services/api/characters", () => ({
  createCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  getActiveCharacter: mocks.getActiveCharacter,
  listCharacters: mocks.listCharacters,
  setActiveCharacter: vi.fn(),
  updateCharacter: vi.fn(),
}));

const user = {
  id: "user-1",
  email: "user@example.com",
  role: "USER",
  premium: {
    productCode: "runescodex_premium",
    access: true,
    licenseStatus: "ACTIVE" as const,
    paymentStatus: "PAID" as const,
  },
};

function Probe() {
  const auth = useAuth();
  return (
    <>
      <span>{auth.status}</span>
      <span>{auth.user?.email ?? "no-user"}</span>
      <button
        onClick={() => void auth.login("user@example.com", "password")}
        type="button"
      >
        login
      </button>
    </>
  );
}

describe("AuthContext session lifecycle", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.fetchMe.mockReset();
    mocks.loginUser.mockReset();
    mocks.listCharacters.mockResolvedValue([]);
    mocks.getActiveCharacter.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("persists the access token after a successful login", async () => {
    mocks.loginUser.mockResolvedValue({ user, accessToken: "signed-session" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "login" }));

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(getAccessToken()).toBe("signed-session");
  });

  it("restores the user from /auth/me after a page refresh", async () => {
    setAccessToken("signed-session");
    mocks.fetchMe.mockResolvedValue(user);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(mocks.fetchMe).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBe("signed-session");
  });

  it("clears an invalid session but preserves it on a transient server error", async () => {
    setAccessToken("invalid-session");
    mocks.fetchMe.mockRejectedValueOnce(
      new ApiError("UNAUTHORIZED", 401, "Unauthorized", null),
    );
    const first = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(getAccessToken()).toBe(""));
    first.unmount();

    setAccessToken("possibly-valid-session");
    mocks.fetchMe.mockRejectedValueOnce(
      new ApiError("HTTP_ERROR", 503, "Unavailable", null),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("anonymous");
    expect(getAccessToken()).toBe("possibly-valid-session");
  });
});
