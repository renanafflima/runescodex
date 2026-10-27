import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ApiError, describeApiError } from "../services/api/errors";
import { redeemVoucher, refreshCheckout, startCheckout } from "../services/api/billing";

function checkoutError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return "Você já possui o Premium ativo.";
  }
  return describeApiError(error);
}

function formatBrl(amountMinor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountMinor / 100);
}

const ORIGIN: Record<string, string> = {
  PURCHASE: "Compra",
  VOUCHER: "Voucher",
  ADMIN_GRANT: "Concessão",
  PARTNERSHIP: "Parceria",
  COMPENSATION: "Compensação",
};

function licenseSummary(premium: NonNullable<ReturnType<typeof useAuth>["user"]>["premium"]) {
  if (!premium) return "Sem licença.";
  if (premium.channel === "staff") {
    return "Acesso administrativo. Não é uma compra e não gera pagamento.";
  }
  if (premium.channel === "store") return "Acesso ativo pela loja do aplicativo.";
  if (premium.licenseStatus === "SUSPENDED") return "Sua licença está suspensa.";
  if (premium.licenseStatus === "REVOKED") return "Sua licença foi revogada.";
  if (premium.licenseStatus === "EXPIRED") return "Sua licença expirou.";
  if (premium.access && premium.term === "FIXED" && premium.expiresAt) {
    const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(premium.expiresAt));
    return `Licença com validade até ${date}.`;
  }
  if (premium.access && premium.term === "LIFETIME") return "Licença vitalícia. Ela pode ser suspensa ou revogada.";
  if (premium.access) return "Sua licença está ativa.";
  return "Sem licença ativa.";
}

export function CheckoutPage() {
  const { user, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const premium = user?.premium;
  const pending = premium?.paymentStatus === "PENDING";

  async function pay() {
    setBusy(true);
    setMessage("");
    try {
      const session = await startCheckout();
      if (!session.checkoutUrl.startsWith("https://")) {
        throw new Error("Checkout URL inválida");
      }
      window.location.assign(session.checkoutUrl);
    } catch (error) {
      setMessage(checkoutError(error));
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      await refreshCheckout();
      await refreshMe();
    } catch (error) {
      setMessage(checkoutError(error));
    } finally {
      setBusy(false);
    }
  }

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await redeemVoucher(code);
      await refreshMe();
      setMessage("Voucher resgatado. Sua licença foi atualizada.");
    } catch (error) {
      setMessage(checkoutError(error));
    } finally {
      setBusy(false);
    }
  }

  if (premium?.access) {
    return (
      <PageContainer className="checkout-page" size="narrow">
        <Card>
          <p className="eyebrow">RuneCodex Premium</p>
          <h1>Premium ativo</h1>
          <p>{licenseSummary(premium)}</p>
          {premium.channel === "staff" ? <p>Origem: Acesso administrativo</p> : null}
          {premium.channel !== "staff" && premium.activatedAt ? (
            <p>
              Ativação:{" "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
                new Date(premium.activatedAt),
              )}
            </p>
          ) : null}
          {premium.channel !== "staff" && premium.source ? (
            <p>Origem: {ORIGIN[premium.source] ?? "Conta"}</p>
          ) : null}
          <ButtonLink to="/hunts">Ir para Hunts</ButtonLink>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="checkout-page" size="narrow">
      <Card>
        <p className="eyebrow">RuneCodex Premium</p>
        <h1>Acesso Premium</h1>
        <p>
          Pagamento único de {formatBrl(4990)}. A licença não expira e não há renovação
          automática. Pix e cartão aparecem conforme a sua conta do Mercado Pago.
        </p>
        <p>O retorno do navegador não libera o acesso. A confirmação acontece no servidor.</p>
        <p>{licenseSummary(premium)}</p>
        {pending ? (
          <p>Pagamento pendente. O conteúdo continua bloqueado até a confirmação.</p>
        ) : null}
        <form onSubmit={(event) => void redeem(event)}>
          <label>
            Código do voucher
            <input
              aria-label="Código do voucher"
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
          </label>
          <Button disabled={busy || code.trim().length < 8} type="submit" variant="secondary">
            Resgatar voucher
          </Button>
        </form>
        {message ? <p role="alert">{message}</p> : null}
        <div className="checkout-page__actions">
          <Button disabled={busy} onClick={() => void pay()}>
            {busy ? "Aguarde" : "Pagar com Mercado Pago"}
          </Button>
          <Button disabled={busy} onClick={() => void refresh()} variant="secondary">
            Atualizar status
          </Button>
          <Link to="/">Voltar à Home</Link>
        </div>
      </Card>
    </PageContainer>
  );
}
