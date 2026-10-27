import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountReferrals } from "./AccountReferrals";

const api = vi.hoisted(() => ({ getMyReferrals: vi.fn() }));

vi.mock("../services/api/referrals", () => api);

describe("AccountReferrals", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the empty state and copies the real link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    api.getMyReferrals.mockResolvedValue({
      code: "RABC2345",
      path: "/?ref=RABC2345",
      rewardCoins: 100,
      summary: { referred: 0, waitingPurchase: 0, pendingDelivery: 0, delivered: 0, onHold: 0, coinsDelivered: 0 },
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    });
    render(<AccountReferrals />);
    expect(await screen.findByRole("heading", { name: "Indique um amigo" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma indicação ainda")).toBeInTheDocument();
    expect(screen.getByText("0 TC")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar link" })[0]!);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/runescodex/?ref=RABC2345"));
  });

  it("renders the friend status returned by the API without an email", async () => {
    api.getMyReferrals.mockResolvedValue({
      code: "RABC2345",
      path: "/?ref=RABC2345",
      rewardCoins: 100,
      summary: { referred: 1, waitingPurchase: 0, pendingDelivery: 1, delivered: 0, onHold: 0, coinsDelivered: 0 },
      items: [{ id: "ref-1", friend: "Ada", createdAt: "2026-10-20T00:00:00.000Z", status: "Recompensa em preparação", validatedAt: "2026-10-21T00:00:00.000Z", deliveredAt: null }],
      page: 1,
      limit: 20,
      total: 1,
    });
    render(<AccountReferrals />);
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Recompensa em preparação")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
