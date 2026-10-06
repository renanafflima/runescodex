import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { apiRequest, withQuery } from "./client";
import { clearAccessToken, getAccessToken, setAccessToken } from "../session";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    clearAccessToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("sends JSON and returns parsed body", async () => {
    const data = await apiRequest<{ ok: boolean }>("/hunts", { auth: false });
    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/hunts");
    expect(options.method).toBe("GET");
  });

  it("sends bearer token when present", async () => {
    setAccessToken("test-token");
    await apiRequest("/characters");
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("does not send authorization for public requests", async () => {
    setAccessToken("test-token");
    await apiRequest("/hunts", { auth: false });
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("throws NETWORK when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(apiRequest("/hunts", { auth: false })).rejects.toMatchObject({
      code: "NETWORK",
    });
  });

  it("throws UNAUTHORIZED and clears the session on 401", async () => {
    setAccessToken("expired");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })),
    );
    await expect(apiRequest("/characters")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBe("");
  });

  it("keeps non-2xx messages from the API body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: ["Nome inválido"] }), { status: 400 }),
      ),
    );
    await expect(apiRequest("/characters", { json: {} })).rejects.toMatchObject({
      status: 400,
      message: "Nome inválido",
    });
  });

  it("serializes query params and skips empty values", () => {
    expect(withQuery("/hunts", { vocation: "EK", level: 400, difficulty: "" })).toBe(
      "/hunts?vocation=EK&level=400",
    );
  });
});
