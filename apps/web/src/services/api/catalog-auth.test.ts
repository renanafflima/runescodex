import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken, setAccessToken } from "../session";
import { listForumThreads } from "./forum";
import { getHuntBySlug, listHunts } from "./hunts";

describe("premium catalog requests send the session", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [], hasMore: false }), { status: 200 })),
    );
    setAccessToken("session-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("sends Authorization on hunt list and detail", async () => {
    await listHunts({ vocation: "EK" });
    await getHuntBySlug("cyclops");
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [, options] of calls) {
      const headers = new Headers((options as RequestInit).headers);
      expect(headers.get("Authorization")).toBe("Bearer session-token");
    }
  });

  it("sends Authorization on forum list", async () => {
    await listForumThreads({ page: 1, limit: 20 });
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.get("Authorization")).toBe("Bearer session-token");
  });
});
