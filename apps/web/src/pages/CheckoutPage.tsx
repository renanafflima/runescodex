import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ApiError, describeApiError } from "../services/api/errors";
import { refreshCheckout, startCheckout } from "../services/api/billing";

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

export function CheckoutPage() {
  const { user, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
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

  if (premium?.access) {
    return (
      <PageContainer className="checkout-page" size="narrow">
        <Card>
          <p className="eyebrow">RuneCodex Premium</p>
          <h1>Premium ativo</h1>
          <p>Sua licença está ativa. O acesso não expira.</p>
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
        {pending ? (
          <p>Pagamento pendente. O conteúdo continua bloqueado até a confirmação.</p>
        ) : null}
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
