import { describe, expect, it } from "vitest";
import { ApiError, describeApiError, messageFromBody } from "./errors";

describe("api errors", () => {
  it("reads nested API messages", () => {
    expect(messageFromBody({ message: ["A", "B"] })).toBe("A\nB");
    expect(messageFromBody({ message: "Invalid credentials" })).toBe("Invalid credentials");
  });

  it("describes network and unauthorized errors without exposing internals", () => {
    expect(describeApiError(new ApiError("NETWORK", 0, "NETWORK", null))).toMatch(/conectar/i);
    expect(describeApiError(new ApiError("UNAUTHORIZED", 401, "Unauthorized", null))).toMatch(/sessão|credenciais/i);
    expect(describeApiError(new ApiError("HTTP_ERROR", 404, "Hunt not found", null))).toMatch(/não encontrado/i);
    expect(describeApiError(new Error("boom"))).toMatch(/não foi possível/i);
  });
});
