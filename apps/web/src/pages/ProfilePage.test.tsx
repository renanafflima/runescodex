import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "ada@runescodex.com",
    createdAt: "2026-01-15T12:00:00.000Z",
    googleLinked: true,
    premium: {
      productCode: "premium",
      access: true,
      licenseStatus: "ACTIVE" as const,
      paymentStatus: "PAID" as const,
      term: "LIFETIME" as const,
    },
  },
  characters: [] as Array<{ id: string; name: string; vocation: string; level: number; world: string }>,
  activeCharacter: null as { id: string; name: string; vocation: string; level: number; world: string } | null,
  status: "ready" as "ready" | "loading",
  logout: vi.fn(),
  linkGoogle: vi.fn(),
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  setActiveCharacter: vi.fn(),
  reloadCharacters: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../services/api/devices", () => ({
  listAccountDevices: vi.fn(async () => ({
    limit: 2,
    active: 2,
    hasPassword: true,
    currentDeviceId: "device-1",
    items: [
      {
        id: "device-1",
        label: "Chrome · Windows",
        deviceType: "desktop",
        osName: "Windows",
        clientName: "Chrome",
        status: "ACTIVE",
        createdAt: "2026-10-20T12:00:00.000Z",
        lastSeenAt: "2026-10-21T12:00:00.000Z",
        current: true,
      },
      {
        id: "device-2",
        label: "Safari · iPhone",
        deviceType: "phone",
        osName: "iOS",
        clientName: "Safari",
        status: "ACTIVE",
        createdAt: "2026-10-18T12:00:00.000Z",
        lastSeenAt: "2026-10-19T12:00:00.000Z",
        current: false,
      },
    ],
  })),
  removeAccountDevice: vi.fn(),
  confirmCurrentDevice: vi.fn(),
}));

vi.mock("../services/api/referrals", () => ({
  getMyReferrals: vi.fn(async () => ({
    code: "RUNE01",
    path: "/?ref=RUNE01",
    rewardCoins: 100,
    summary: {
      referred: 0,
      waitingPurchase: 0,
      pendingDelivery: 0,
      delivered: 0,
      onHold: 0,
      coinsDelivered: 0,
    },
    items: [],
    page: 1,
    limit: 20,
    total: 0,
  })),
}));

vi.mock("../services/api/tickets", () => ({
  listMyTickets: vi.fn(async () => ({ items: [] })),
  getMyTicket: vi.fn(),
  createMyTicket: vi.fn(),
  replyMyTicket: vi.fn(),
  addTicketEvidence: vi.fn(),
  evidenceFileError: () => "",
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    auth.status = "ready";
    auth.characters = [];
    auth.activeCharacter = null;
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a loading state before the account is ready", () => {
    auth.status = "loading";
    render(<ProfilePage />);
    expect(screen.getByText("Carregando perfil")).toBeInTheDocument();
  });

  it("renders the authenticated account, locked emblems and the two-device limit", async () => {
    render(<ProfilePage />);

    expect(screen.getByRole("heading", { name: "ada@runescodex.com" })).toBeInTheDocument();
    expect(screen.getByText(/Cadastro em/)).toBeInTheDocument();
    expect(screen.getAllByText("Acesso de compra única").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Nenhum personagem" })).toBeInTheDocument();
    expect(document.querySelector(".profile-hero__scene")).toBeTruthy();
    expect(await screen.findByText("Equipamentos vinculados: 2 de 2")).toBeInTheDocument();
    expect(screen.getByText("0 / 12 conquistadas")).toBeInTheDocument();
    expect(screen.queryByText(/Desbloqueada/)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".emblem--locked")).toHaveLength(12);

    fireEvent.click(screen.getByRole("button", { name: "Primeiros Passos" }));
    expect(await screen.findByText(/critério de desbloqueio ainda não foi aprovado/i)).toBeInTheDocument();
    expect(screen.getByText(/não conquistada/i)).toBeInTheDocument();
  });

  it("lists characters and activates one through the existing action", async () => {
    auth.characters = [
      { id: "char-1", name: "Arvandor", vocation: "ED", level: 412, world: "Belobra" },
      { id: "char-2", name: "Nyxara", vocation: "MS", level: 188, world: "Honbra" },
    ];
    const active = auth.characters[0];
    if (!active) throw new Error("Personagem ausente");
    auth.activeCharacter = active;
    render(<ProfilePage />);

    expect(screen.getAllByText("Arvandor").length).toBeGreaterThan(0);
    expect(screen.getByText("Nyxara")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    expect(auth.setActiveCharacter).toHaveBeenCalledWith("char-2");
    expect(await screen.findByText("Equipamentos vinculados: 2 de 2")).toBeInTheDocument();
  });
});
