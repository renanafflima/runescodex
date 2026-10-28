import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from "./session";

describe("session storage", () => {
  afterEach(() => {
    clearAccessToken();
    window.sessionStorage.clear();
  });

  it("persists the access token for requests and page refreshes", () => {
    setAccessToken("signed-session");

    expect(window.sessionStorage.getItem("runecodex.accessToken")).toBe(
      "signed-session",
    );
    expect(getAccessToken()).toBe("signed-session");
  });

  it("notifies auth state when a 401 clears the session", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);

    setAccessToken("signed-session");
    clearAccessToken();

    expect(listener).toHaveBeenLastCalledWith("");
    unsubscribe();
  });
});
