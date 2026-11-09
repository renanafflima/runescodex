import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartyPanel } from "./PartyPanel";

const { listMyParties, createParty, listReceivedPartyInvites } = vi.hoisted(() => ({
  listMyParties: vi.fn(),
  createParty: vi.fn(),
  listReceivedPartyInvites: vi.fn(),
}));

vi.mock("../../services/api/parties", async () => {
  const party = {
    id: "party-1",
    name: "Os Caçadores",
    members: [],
  };
  return {
  listMyParties,
  createParty,
  listReceivedPartyInvites,
  listSentPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listPartyNotifications: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  getParty: vi.fn(async () => party),
  listHuntSessions: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  invitePartyMember: vi.fn(),
  acceptPartyInvite: vi.fn(),
  declinePartyInvite: vi.fn(),
  leaveParty: vi.fn(),
  archiveParty: vi.fn(),
  cancelPartyInvite: vi.fn(),
  cancelHuntSession: vi.fn(),
  transferPartyLeader: vi.fn(),
  createHuntSession: vi.fn(),
  startHuntSession: vi.fn(),
  completeHuntSession: vi.fn(),
  listPartyActivities: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  markPartyNotificationRead: vi.fn(),
  removePartyMember: vi.fn(),
  };
});

vi.mock("../../services/api/bosstiary-progress", () => ({
  listBosstiaryProgressRotations: vi.fn(async () => []),
}));

describe("PartyPanel", () => {
  beforeEach(() => {
    listMyParties.mockReset();
    createParty.mockReset();
    listReceivedPartyInvites.mockReset();
    listMyParties.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, hasMore: false });
    listReceivedPartyInvites.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, hasMore: false });
    const party = {
      id: "party-1",
      name: "Os Caçadores",
      description: null,
      createdById: "user-1",
      status: "ACTIVE",
      isPrivate: true,
      myRole: "LEADER",
      memberCount: 1,
      members: [
        {
          id: "m1",
          userId: "user-1",
          role: "LEADER",
          status: "ACTIVE",
          joinedAt: "2026-11-09T00:00:00.000Z",
          name: "Hero",
          vocation: "EK",
          level: 400,
          avatar: "H",
        },
      ],
      createdAt: "2026-11-09T00:00:00.000Z",
    };
    createParty.mockResolvedValue(party);
  });

  afterEach(() => cleanup());

  it("creates a party from the community area", async () => {
    render(<PartyPanel />);
    expect(await screen.findByRole("heading", { name: "Minhas Partys" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Os Caçadores" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Party" }));
    await waitFor(() => expect(createParty).toHaveBeenCalledWith({ name: "Os Caçadores", description: undefined }));
  });
});
