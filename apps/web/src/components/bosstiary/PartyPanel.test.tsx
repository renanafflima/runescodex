import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartyPanel } from "./PartyPanel";

const { listMyParties, createParty, listReceivedPartyInvites, getParty, listPartyRotations } = vi.hoisted(() => ({
  listMyParties: vi.fn(),
  createParty: vi.fn(),
  listReceivedPartyInvites: vi.fn(),
  getParty: vi.fn(),
  listPartyRotations: vi.fn(),
}));

vi.mock("../../services/api/parties", async () => {
  return {
  listMyParties,
  createParty,
  listReceivedPartyInvites,
  listSentPartyInvites: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  listPartyNotifications: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, hasMore: false })),
  getParty,
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
  listPartyRotations,
  markPartyNotificationRead: vi.fn(),
  removePartyMember: vi.fn(),
  };
});

vi.mock("../../services/api/bosstiary-progress", () => ({
  listBosstiaryProgressRotations: vi.fn(async () => []),
}));

vi.mock("../../services/api/community-rotations", () => ({
  createCommunityRotation: vi.fn(),
}));

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    activeCharacter: { vocation: "EK" },
  }),
}));

vi.mock("../../domain/bosstiary-catalog", () => ({
  loadBosstiaryCatalog: () => ({ entries: [] }),
  searchBosstiaryCatalog: () => [],
  officialBossImage: () => null,
}));

describe("PartyPanel", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
    listMyParties.mockReset();
    createParty.mockReset();
    listReceivedPartyInvites.mockReset();
    getParty.mockReset();
    listPartyRotations.mockReset();
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
    getParty.mockResolvedValue(party);
    listPartyRotations.mockResolvedValue({
      items: [
        {
          id: "rot-shared",
          title: "Ferumbras e Orshabaal",
          description: null,
          accessRequirements: null,
          additionalInfo: null,
          recommendedLevel: "L700",
          recommendedLevelLabel: "Level 700+",
          huntMode: "PARTY",
          plannedDurationMinutes: 60,
          vocation: "EK",
          characterLevel: null,
          partySize: 4,
          observedTotalMinutes: null,
          combatMinutes: null,
          travelMinutes: null,
          status: "PUBLISHED",
          visibility: "GROUP",
          partyId: "party-1",
          partyName: "Os Caçadores",
          createdAt: "2026-11-12T12:00:00.000Z",
          updatedAt: "2026-11-12T12:00:00.000Z",
          author: { id: "user-2", name: "Nyx", vocation: "ED", level: 800 },
          bosses: [
            {
              id: "stop-1",
              position: 1,
              notes: null,
              bossId: null,
              bossName: "Ferumbras",
              slug: "ferumbras",
              name: "Ferumbras",
              image: null,
            },
          ],
          likesCount: 0,
          favoritesCount: 0,
          commentsCount: 0,
          likedByMe: false,
          favoritedByMe: false,
          testedByAuthor: false,
          testedByMe: false,
          featured: false,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
  });

  afterEach(() => cleanup());

  it("creates a party from the community area", async () => {
    render(
      <MemoryRouter>
        <PartyPanel />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Minhas Partys" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Os Caçadores" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Party" }));
    await waitFor(() => expect(createParty).toHaveBeenCalledWith({ name: "Os Caçadores", description: undefined }));
  });

  it("lists the player's parties and shows shared rotations inside a room", async () => {
    listMyParties.mockResolvedValue({
      items: [
        {
          id: "party-1",
          name: "Os Caçadores",
          description: null,
          createdById: "user-1",
          status: "ACTIVE",
          isPrivate: true,
          myRole: "LEADER",
          memberCount: 4,
          members: [],
          createdAt: "2026-11-09T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });

    render(
      <MemoryRouter>
        <PartyPanel />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /Os Caçadores/ })).toBeInTheDocument();
    expect(screen.getByText(/4 participantes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Os Caçadores/ }));
    expect(await screen.findByRole("heading", { name: "Rotações compartilhadas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ferumbras e Orshabaal" })).toHaveAttribute(
      "href",
      "/bosstiary/community/rot-shared",
    );
    expect(screen.getByText("Nyx")).toBeInTheDocument();
    expect(listPartyRotations).toHaveBeenCalledWith("party-1");
  });
});
