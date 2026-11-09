import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BosstiaryProgressPanel } from "./BosstiaryProgressPanel";

const {
  getBosstiaryProgressSummary,
  listBosstiaryProgressActivities,
  listBosstiaryProgressRotations,
  listBosstiaryProgressChecklist,
  createBosstiaryProgressActivity,
} = vi.hoisted(() => ({
  getBosstiaryProgressSummary: vi.fn(),
  listBosstiaryProgressActivities: vi.fn(),
  listBosstiaryProgressRotations: vi.fn(),
  listBosstiaryProgressChecklist: vi.fn(),
  createBosstiaryProgressActivity: vi.fn(),
}));

vi.mock("../../services/api/bosstiary-progress", () => ({
  getBosstiaryProgressSummary,
  listBosstiaryProgressActivities,
  listBosstiaryProgressRotations,
  listBosstiaryProgressChecklist,
  createBosstiaryProgressActivity,
  updateBosstiaryProgressActivity: vi.fn(),
  deleteBosstiaryProgressActivity: vi.fn(),
  updateBosstiaryProgressChecklist: vi.fn(),
}));

vi.mock("../../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog: () => ({
    skipped: 0,
    entries: [
      {
        name: "Grand Master Oberon",
        slug: "grand-master-oberon",
        imageUrl: null,
      },
    ],
  }),
  searchBosstiaryCatalog: (
    entries: Array<{ name: string; slug: string }>,
    query: string,
  ) => entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())),
}));

vi.mock("../../services/api/parties", () => ({
  listMyParties: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listHuntSessions: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listReceivedPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listSentPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listPartyNotifications: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  markPartyNotificationRead: vi.fn(),
  cancelPartyInvite: vi.fn(),
  cancelHuntSession: vi.fn(),
  transferPartyLeader: vi.fn(),
  createParty: vi.fn(),
}));

describe("BosstiaryProgressPanel", () => {
  beforeEach(() => {
    getBosstiaryProgressSummary.mockReset();
    listBosstiaryProgressActivities.mockReset();
    listBosstiaryProgressRotations.mockReset();
    listBosstiaryProgressChecklist.mockReset();
    createBosstiaryProgressActivity.mockReset();
    getBosstiaryProgressSummary.mockResolvedValue({
      bossesDefeated: 3,
      dropsRegistered: 2,
      activitiesRegistered: 12,
      bossesTracked: 3,
      bossesCataloged: 6,
    });
    listBosstiaryProgressActivities.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    });
    listBosstiaryProgressRotations.mockResolvedValue([]);
    listBosstiaryProgressChecklist.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    });
    createBosstiaryProgressActivity.mockResolvedValue({ id: "act-1" });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows live summary numbers and registers a kill", async () => {
    render(<BosstiaryProgressPanel />);
    expect(await screen.findByText("Bosses derrotados")).toBeInTheDocument();
    expect(screen.getByText("3 / 6")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Boss"), { target: { value: "ob" } });
    fireEvent.click(await screen.findByRole("button", { name: /Grand Master Oberon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar registro" }));
    await waitFor(() =>
      expect(createBosstiaryProgressActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "BOSS_KILL",
          slug: "grand-master-oberon",
          bossName: "Grand Master Oberon",
        }),
      ),
    );
  });

  it("loads the personal checklist independently", async () => {
    render(<BosstiaryProgressPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: "Todos os bosses" }));
    await waitFor(() => expect(listBosstiaryProgressChecklist).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Todos os bosses" })).toBeInTheDocument();
  });
});
