import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/api/errors";
import { AdminLicensesPage } from "./AdminLicensesPage";

const api = vi.hoisted(() => ({
  getLicenseOverview: vi.fn(),
  listAdminLicenses: vi.fn(),
  listAdminPayments: vi.fn(),
  listAdminVouchers: vi.fn(),
  getLicenseActivity: vi.fn(),
  getAdminLicense: vi.fn(),
  getAdminPayment: vi.fn(),
  changeAdminLicense: vi.fn(),
  changeAdminVoucher: vi.fn(),
  createAdminVoucher: vi.fn(),
  grantAdminLicense: vi.fn(),
  searchLicenseUsers: vi.fn(),
  syncAdminPayment: vi.fn(),
}));

vi.mock("../../services/api/admin-licenses", () => api);

const overview = {
  activeLicenses: 0,
  lifetimeLicenses: 0,
  fixedLicenses: 0,
  grantedLicenses: 0,
  purchasedLicenses: 0,
  voucherLicenses: 0,
  partnershipLicenses: 0,
  activeVouchers: 0,
  redemptions: 0,
  approvedPayments: [],
  pendingPayments: [],
  rejectedPayments: [],
  refundedPayments: [],
  commercialDiscount: { available: false, reason: "Não integrado" },
};

function show(path = "/admin/licenses") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminLicensesPage />
    </MemoryRouter>,
  );
}

describe("AdminLicensesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows a loading state before the overview", () => {
    api.getLicenseOverview.mockReturnValue(new Promise(() => undefined));
    show();
    expect(screen.getByRole("heading", { name: "Licenças" })).toBeInTheDocument();
    expect(document.querySelector("[aria-busy='true']")).toBeTruthy();
  });

  it("shows the permission error", async () => {
    api.getLicenseOverview.mockRejectedValue(new ApiError("HTTP_ERROR", 403, "forbidden", null));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão");
  });

  it("shows an empty license list", async () => {
    api.listAdminLicenses.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, hasMore: false });
    show("/admin/licenses?tab=licenses");
    expect(await screen.findByText("Nenhum registro neste recorte.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pesquisar licença"), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(api.listAdminLicenses).toHaveBeenCalledWith({
      page: 1,
      search: "ada@example.com",
      status: "",
    }));
  });

  it("paginates payments and shows the stored provider timeline", async () => {
    const payment = {
      id: "payment-1",
      userId: "user-1",
      userName: "Ada",
      email: "ada@example.com",
      product: "RUNECODEX_PREMIUM",
      providerPaymentId: "mp-1",
      providerStatus: "approved",
      status: "PAID",
      currency: "BRL",
      amountMinor: 4990,
      licenseId: "license-1",
      createdAt: "2026-10-02T00:00:00.000Z",
      paidAt: "2026-10-02T00:00:00.000Z",
      refundedAt: null,
      syncedAt: null,
    };
    api.getLicenseOverview.mockResolvedValue(overview);
    api.listAdminPayments.mockResolvedValue({ items: [payment], page: 1, limit: 20, total: 25 });
    api.getAdminPayment.mockResolvedValue({
      ...payment,
      events: [{ id: "event-1", type: "PAYMENT_PAID", provider: "mercadopago", createdAt: "2026-10-02T00:00:00.000Z" }],
    });
    show("/admin/licenses?tab=payments");
    expect(await screen.findByRole("button", { name: "Próxima" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Eventos" }));
    expect(await screen.findByText(/Pagamento aprovado/)).toBeInTheDocument();
    expect(api.getAdminPayment).toHaveBeenCalledWith("payment-1");
  });

  it("shows an empty voucher list and the unavailable discount", async () => {
    api.getLicenseOverview.mockResolvedValue(overview);
    show();
    expect(await screen.findByText("Não disponível")).toBeInTheDocument();
    expect(screen.getByText("Licenças ativas")).toBeInTheDocument();
  });
});
