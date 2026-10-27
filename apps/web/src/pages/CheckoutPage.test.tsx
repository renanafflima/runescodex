import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api/errors";
import { CheckoutPage } from "./CheckoutPage";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "ada@example.com",
    premium: {
      access: false,
      licenseStatus: null,
      paymentStatus: "NONE",
      term: null,
      source: null,
      expiresAt: null,
      activatedAt: null,
      channel: null,
    },
  } as {
    id: string;
    email: string;
    role?: string;
    premium?: {
      access: boolean;
      licenseStatus: string | null;
      paymentStatus: string;
      term?: string | null;
      source?: string | null;
      expiresAt?: string | null;
      activatedAt?: string | null;
      channel?: string | null;
    };
  },
  refreshMe: vi.fn(),
}));

const billing = vi.hoisted(() => ({
  redeemVoucher: vi.fn(),
  startCheckout: vi.fn(),
  refreshCheckout: vi.fn(),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("../services/api/billing", () => billing);

function show() {
  return render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

describe("CheckoutPage license", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    auth.user.premium = {
      access: false,
      licenseStatus: null,
      paymentStatus: "NONE",
      term: null,
      source: null,
      expiresAt: null,
      activatedAt: null,
      channel: null,
    };
  });

  it("shows an error when the voucher is rejected", async () => {
    billing.redeemVoucher.mockRejectedValue(
      new ApiError("HTTP_ERROR", 400, "Código inválido ou indisponível", null),
    );
    show();
    fireEvent.change(screen.getByLabelText("Código do voucher"), {
      target: { value: "RC-TEST-CODE-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resgatar voucher" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou indisponível");
    expect(billing.redeemVoucher).toHaveBeenCalledWith("RC-TEST-CODE-1234");
  });

  it("refreshes the signed-in account after a valid redeem", async () => {
    billing.redeemVoucher.mockResolvedValue({ access: true, licenseStatus: "ACTIVE" });
    show();
    fireEvent.change(screen.getByLabelText("Código do voucher"), {
      target: { value: "RC-TEST-CODE-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resgatar voucher" }));
    await waitFor(() => expect(auth.refreshMe).toHaveBeenCalled());
  });

  it("shows lifetime access without a payment prompt", () => {
    auth.user.premium = {
      access: true,
      licenseStatus: "ACTIVE",
      paymentStatus: "NONE",
      term: "LIFETIME",
      source: "ADMIN_GRANT",
      expiresAt: null,
      activatedAt: "2026-10-20T00:00:00.000Z",
      channel: "license",
    };
    show();
    expect(screen.getByText("Licença vitalícia. Ela pode ser suspensa ou revogada.")).toBeInTheDocument();
    expect(screen.getByText("Origem: Concessão")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código do voucher")).not.toBeInTheDocument();
  });

  it("shows administrative access without asking an ADMIN to pay", () => {
    auth.user = {
      ...auth.user,
      role: "ADMIN",
      premium: {
        access: true,
        licenseStatus: null,
        paymentStatus: "NONE",
        term: null,
        source: null,
        expiresAt: null,
        activatedAt: null,
        channel: "staff",
      },
    };
    show();
    expect(
      screen.getByText("Acesso administrativo. Não é uma compra e não gera pagamento."),
    ).toBeInTheDocument();
    expect(screen.getByText("Origem: Acesso administrativo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar com Mercado Pago" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Código do voucher")).not.toBeInTheDocument();
  });
});
