import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deliverReferralReward, getAdminReferralOverview, listAdminReferrals, type AdminReferralRow } from "../../services/api/referrals";
import { AdminState, adminError } from "./admin-ui";

export function AdminReferralsPage() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAdminReferralOverview>> | null>(null);
  const [rows, setRows] = useState<AdminReferralRow[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextOverview, nextList] = await Promise.all([
        getAdminReferralOverview(),
        listAdminReferrals(appliedSearch),
      ]);
      setOverview(nextOverview);
      setRows(nextList.items);
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Indicações</h1>
          <p className="admin-page__lead">
            Cada indicação elegível libera 100 TC para entrega manual. O portal não envia moedas ao Tibia.
          </p>
        </div>
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        {overview ? (
          <div className="device-grid">
            <article className="admin-metric"><header><span>Códigos</span></header><strong>{overview.codes}</strong></article>
            <article className="admin-metric"><header><span>Indicações</span></header><strong>{overview.attributions}</strong></article>
            <article className="admin-metric"><header><span>Aguardando compra</span></header><strong>{overview.waitingPurchase}</strong></article>
            <article className="admin-metric"><header><span>TC pendentes</span></header><strong>{overview.coinsPending}</strong></article>
            <article className="admin-metric"><header><span>TC entregues</span></header><strong>{overview.coinsDelivered}</strong></article>
            <article className="admin-metric"><header><span>Em análise</span></header><strong>{overview.onHold}</strong></article>
          </div>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        <form
          className="admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search.trim());
          }}
        >
          <label>
            Busca
            <input aria-label="Buscar indicação" onChange={(event) => setSearch(event.target.value)} value={search} />
          </label>
          <button type="submit">Filtrar</button>
        </form>
        {rows.length === 0 ? <p className="admin-note">Nenhuma indicação neste recorte.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Indicador</th><th>Indicado</th><th>Código</th><th>Recompensa</th><th>Chamado</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.referrer.name}<br />{row.referrer.email}</td>
                    <td>{row.referred.name}<br />{row.referred.email}</td>
                    <td>{row.code}</td>
                    <td>{row.reward ? `${row.reward.status} · 100 TC` : "Aguardando compra"}</td>
                    <td>{row.reward?.ticketId ? <Link to={`/admin/tickets/${row.reward.ticketId}`}>Abrir chamado</Link> : "—"}</td>
                    <td>
                      {row.reward?.status === "PENDING_DELIVERY" ? (
                        <button
                          onClick={() => {
                            const rewardId = row.reward?.id;
                            if (!rewardId) return;
                            if (window.confirm(`Confirmar a entrega manual de 100 TC para ${row.referrer.name}? O Tibia não será consultado.`)) {
                              void deliverReferralReward(rewardId)
                                .then(() => {
                                  setNotice("Entrega manual registrada.");
                                  return load();
                                })
                                .catch((caught: unknown) => setError(adminError(caught)));
                            }
                          }}
                          type="button"
                        >
                          Confirmar entrega
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          className="admin-form admin-panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirming) return;
            void deliverReferralReward(confirming)
              .then(() => {
                setNotice("Entrega manual registrada. O Tibia não foi consultado.");
                setConfirming("");
                return load();
              })
              .catch((caught: unknown) => setError(adminError(caught)));
          }}
        >
          <h2>Confirmar entrega</h2>
          <p>Informe o ID da recompensa que já recebeu 100 TC no Tibia.</p>
          <input aria-label="ID da recompensa" onChange={(event) => setConfirming(event.target.value.trim())} value={confirming} />
          <button disabled={!confirming} type="submit">Confirmar entrega manual</button>
        </form>
      </AdminState>
    </>
  );
}
