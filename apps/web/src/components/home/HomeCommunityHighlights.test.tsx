import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeCommunityHighlights } from "./HomeCommunityHighlights";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { premium: { access: true } },
  }),
}));

vi.mock("../../services/api/community-rotations", () => ({
  listCommunityRotations: () => Promise.reject(new Error("offline")),
}));

describe("HomeCommunityHighlights", () => {
  afterEach(() => cleanup());

  it("keeps editorial community cards when the existing API fails", async () => {
    render(
      <MemoryRouter>
        <HomeCommunityHighlights />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Rotas de bosses/i })).toHaveAttribute("href", "/bosstiary");
    });
  });
});
