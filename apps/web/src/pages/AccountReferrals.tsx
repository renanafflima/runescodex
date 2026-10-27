import { useCallback, useEffect, useState } from "react";
import { CatalogEmpty, CatalogLoading } from "../components/catalog/CatalogState";
import { Section } from "../components/layout/Section";
import { Button } from "../components/ui/Button";
import { referralLink } from "../auth/referral-code";
import { getMyReferrals, type ReferralAccount } from "../services/api/referrals";
import { describeApiError } from "../services/api/errors";

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function AccountReferrals() {
  const [data, setData] = useState<ReferralAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getMyReferrals());
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = data ? referralLink(data.code) : "";

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied("Link copiado.");
  }

  async function shareLink() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "RuneCodex", text: "Venha para o RuneCodex.", url: link });
      return;
    }
    await copyLink();
  }

  return (
    <Section
      className="device-section"
      description="Indique um amigo. Quando a compra da licença for confirmada, você ganha 100 TC. A equipe entrega as moedas manualmente no Tibia."
      eyebrow="Conta"
      title="Indique um amigo"
    >
      {loading ? <CatalogLoading label="Carregando indicações" /> : null}
      {!loading && error ? (
        <div className="device-card" role="alert">
          <p>{error}</p>
          <Button onClick={() => void load()} type="button" variant="secondary">Tentar novamente</Button>
        </div>
      ) : null}
      {!loading && !error && data ? (
        <>
          <p className="referral-link">{link}</p>
          <div className="device-card__actions">
            <Button onClick={() => void copyLink()} type="button">Copiar link</Button>
            <Button onClick={() => void shareLink()} type="button" variant="secondary">Compartilhar convite</Button>
          </div>
          {copied ? <p role="status">{copied}</p> : null}
          <div className="device-grid">
            <article className="device-card"><strong>{data.summary.referred}</strong><span>Amigos indicados</span></article>
            <article className="device-card"><strong>{data.summary.waitingPurchase}</strong><span>Indicações pendentes</span></article>
            <article className="device-card"><strong>{data.summary.pendingDelivery}</strong><span>Recompensas pendentes</span></article>
            <article className="device-card"><strong>{data.summary.coinsDelivered} TC</strong><span>TC recebidas</span></article>
          </div>
          {data.items.length === 0 ? (
            <CatalogEmpty
              action={<Button onClick={() => void copyLink()} type="button">Copiar link</Button>}
              description="Compartilhe seu link. O amigo precisa criar a conta por ele e comprar uma licença elegível."
              title="Nenhuma indicação ainda"
            />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Amigo</th><th>Data</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.friend}</td>
                      <td>{when(item.deliveredAt || item.validatedAt || item.createdAt)}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Section>
  );
}
