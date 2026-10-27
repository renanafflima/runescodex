import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { AccountDevices } from "./AccountDevices";

const api = vi.hoisted(() => ({
  listAccountDevices: vi.fn(),
  removeAccountDevice: vi.fn(),
  confirmCurrentDevice: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../services/api/devices", () => api);

const device = {
  id: "device-1",
  label: "Chrome · Windows",
  deviceType: "desktop",
  osName: "Windows",
  clientName: "Chrome",
  status: "ACTIVE",
  createdAt: "2026-10-20T12:00:00.000Z",
  lastSeenAt: "2026-10-20T18:00:00.000Z",
  current: true,
};

describe("AccountDevices", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the real counter, the current device and an empty state", async () => {
    api.listAccountDevices.mockResolvedValueOnce({
      limit: 2,
      active: 1,
      hasPassword: true,
      currentDeviceId: "device-1",
      items: [device],
    });
    const view = render(<AccountDevices />);
    expect(await screen.findByText("Equipamentos vinculados: 1 de 2")).toBeInTheDocument();
    expect(screen.getByText("Chrome · Windows")).toBeInTheDocument();
    expect(screen.getByText("Este equipamento")).toBeInTheDocument();
    expect(view.container.querySelector(".device-grid")).toBeTruthy();

    api.listAccountDevices.mockResolvedValueOnce({
      limit: 2,
      active: 0,
      hasPassword: true,
      currentDeviceId: null,
      items: [],
    });
    cleanup();
    render(<AccountDevices />);
    expect(await screen.findByText("Nenhum equipamento")).toBeInTheDocument();
    expect(screen.getByText("Equipamentos vinculados: 0 de 2")).toBeInTheDocument();
  });

  it("shows an API error and asks for the password before removal", async () => {
    api.listAccountDevices.mockRejectedValueOnce(new ApiError("HTTP_ERROR", 500, "falhou", null));
    render(<AccountDevices />);
    expect(await screen.findByRole("alert")).toHaveTextContent("falhou");

    cleanup();
    api.listAccountDevices.mockResolvedValue({
      limit: 2,
      active: 2,
      hasPassword: true,
      currentDeviceId: "device-1",
      items: [device, { ...device, id: "device-2", label: "Notebook", current: false }],
    });
    render(<AccountDevices />);
    expect(await screen.findByText("Equipamentos vinculados: 2 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover equipamento" })[0]!);
    expect(screen.getByLabelText("Senha da conta")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remover equipamento" })).toBeInTheDocument();
  });
});
