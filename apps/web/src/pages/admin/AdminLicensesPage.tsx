import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../services/api/errors";
import {
  cancelPendingGrant,
  changeAdminLicense,
  changeAdminVoucher,
  createAdminVoucher,
  getAdminLicense,
  getAdminPayment,
  getAdminVoucher,
  getLicenseActivity,
  getLicenseOverview,
  grantAdminLicense,
  listAdminLicenses,
  listAdminPayments,
  listAdminVouchers,
  listPendingGrants,
  schedulePendingGrant,
  searchLicenseUsers,
  syncAdminPayment,
  type AdminLicense,
  type AdminPayment,
  type AdminPaymentEvent,
  type AdminVoucher,
  type CreatedVoucher,
  type LicenseOverview,
  type LicenseUser,
  type PendingGrant,
} from "../../services/api/admin-licenses";
import { AdminState, Pager, adminError } from "./admin-ui";

const TABS = [
  ["overview", "Visão geral"],
  ["licenses", "Licenças"],
  ["payments", "Pagamentos"],
  ["vouchers", "Vouchers"],
  ["grant", "Conceder"],
  ["history", "Histórico"],
] as const;

const STATUS: Record<string, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  REVOKED: "Revogada",
  EXPIRED: "Expirada",
  PENDING: "Pendente",
  PAID: "Aprovado",
  FAILED: "Recusado",
  REFUNDED: "Reembolsado ou contestado",
  PAUSED: "Pausado",
  EXHAUSTED: "Esgotado",
  CLOSED: "Encerrado",
  SCHEDULED: "Agendado",
};

const SOURCE: Record<string, string> = {
  PURCHASE: "Compra",
  VOUCHER: "Voucher",
  ADMIN_GRANT: "Concessão",
  PARTNERSHIP: "Parceria",
  COMPENSATION: "Compensação",
};

const PAYMENT_EVENT: Record<string, string> = {
  PAYMENT_PENDING: "Pagamento pendente",
  PAYMENT_PAID: "Pagamento aprovado",
  PAYMENT_FAILED: "Pagamento recusado",
  PAYMENT_REFUNDED: "Pagamento reembolsado ou contestado",
};

const CATEGORY: Record<string, string> = {
  COLLABORATOR: "Colaborador",
  PARTNERSHIP: "Parceria",
  CONTENT_CREATOR: "Criador de conteúdo",
  COMPENSATION: "Compensação",
  OTHER: "Outro",
};

function label(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

function money(rows: LicenseOverview["approvedPayments"]) {
  if (rows.length === 0) return "0";
  return rows
    .map((row) => {
      const formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: row.currency,
      }).format(row.amountMinor / 100);
      return `${formatted} (${row.count})`;
    })
    .join(" · ");
}

function when(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function emptyOverview(): LicenseOverview {
  return {
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
    commercialDiscount: { available: false, reason: "Não disponível" },
  };
}

export function AdminLicensesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<LicenseOverview>(emptyOverview);
  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [licenseTotal, setLicenseTotal] = useState(0);
  const [licensePage, setLicensePage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [selected, setSelected] = useState<Awaited<ReturnType<typeof getAdminLicense>> | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentLimit, setPaymentLimit] = useState(20);
  const [paymentDetail, setPaymentDetail] = useState<(AdminPayment & { events: AdminPaymentEvent[] }) | null>(null);
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherTotal, setVoucherTotal] = useState(0);
  const [voucherLimit, setVoucherLimit] = useState(20);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherStatus, setVoucherStatus] = useState("");
  const [appliedVoucherSearch, setAppliedVoucherSearch] = useState("");
  const [appliedVoucherStatus, setAppliedVoucherStatus] = useState("");
  const [voucherDetail, setVoucherDetail] = useState<Awaited<ReturnType<typeof getAdminVoucher>> | null>(null);
  const [created, setCreated] = useState<CreatedVoucher | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; action: string; summary: string; createdAt: string }>>([]);
  const [users, setUsers] = useState<LicenseUser[]>([]);
  const [chosen, setChosen] = useState<LicenseUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingRows, setPendingRows] = useState<PendingGrant[]>([]);
  const [grantTerm, setGrantTerm] = useState<"LIFETIME" | "FIXED">("LIFETIME");
  const [grantDays, setGrantDays] = useState("30");
  const [grantCategory, setGrantCategory] = useState("COLLABORATOR");
  const [grantReason, setGrantReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");

  function openTab(next: string) {
    const copy = new URLSearchParams(params);
    copy.set("tab", next);
    setParams(copy);
    setNotice("");
    setError("");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        setOverview(await getLicenseOverview());
      } else if (tab === "licenses") {
        const page = await listAdminLicenses({ page: licensePage, search: appliedSearch, status: appliedStatus });
        setLicenses(page.items);
        setLicenseTotal(page.total);
      } else if (tab === "payments") {
        const [totals, page] = await Promise.all([
          getLicenseOverview(),
          listAdminPayments({ page: paymentPage }),
        ]);
        setOverview(totals);
        setPayments(page.items);
        setPaymentTotal(page.total);
        setPaymentLimit(page.limit);
      } else if (tab === "vouchers") {
        const page = await listAdminVouchers({
          page: voucherPage,
          search: appliedVoucherSearch,
          status: appliedVoucherStatus,
        });
        setVouchers(page.items);
        setVoucherTotal(page.total);
        setVoucherLimit(page.limit);
      } else if (tab === "grant") {
        const page = await listPendingGrants({ status: "PENDING" });
        setPendingRows(page.items);
      } else if (tab === "history") {
        setActivity(await getLicenseActivity());
      }
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [
    appliedSearch,
    appliedStatus,
    appliedVoucherSearch,
    appliedVoucherStatus,
    licensePage,
    paymentPage,
    tab,
    voucherPage,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const licenseId = params.get("license") || "";
  useEffect(() => {
    if (tab !== "licenses" || !licenseId) return;
    let active = true;
    void getAdminLicense(licenseId)
      .then((row) => {
        if (active) setSelected(row);
      })
      .catch((caught: unknown) => {
        if (active) setError(adminError(caught));
      });
    return () => {
      active = false;
    };
  }, [licenseId, tab]);

  async function openPayment(id: string) {
    setError("");
    try {
      setPaymentDetail(await getAdminPayment(id));
    } catch (caught) {
      setError(adminError(caught));
    }
  }

  async function openLicense(id: string) {
    setError("");
    try {
      setSelected(await getAdminLicense(id));
    } catch (caught) {
      setError(adminError(caught));
    }
  }

  async function mutate(action: "suspend" | "revoke" | "restore") {
    if (!selected) return;
    setNotice("");
    try {
      const next = await changeAdminLicense(selected.id, action, { reason });
      setSelected(await getAdminLicense(next.id));
      setReason("");
      setNotice("Alteração registrada.");
      await load();
    } catch (caught) {
      setError(adminError(caught));
    }
  }

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Licenças</h1>
          <p className="admin-page__lead">
            Compras, vouchers e concessões do RuneCodex Premium. Pendente não entra como receita.
          </p>
        </div>
      </header>
      <div className="admin-actions" role="tablist">
        {TABS.map(([id, name]) => (
          <button
            aria-selected={tab === id}
            key={id}
            onClick={() => openTab(id)}
            role="tab"
            type="button"
          >
            {name}
          </button>
        ))}
      </div>
      {notice ? <p className="admin-note">{notice}</p> : null}
      <AdminState
        empty={false}
        error={error}
        loading={loading}
        onRetry={() => void load()}
      >
        {tab === "overview" ? <OverviewCards overview={overview} /> : null}
        {tab === "licenses" ? (
          <div className="admin-panel">
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                setLicensePage(1);
                setAppliedSearch(search.trim());
                setAppliedStatus(status);
              }}
            >
              <input
                aria-label="Pesquisar licença"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="E-mail, nome ou ID"
                value={search}
              />
              <select aria-label="Status da licença" onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativa</option>
                <option value="SUSPENDED">Suspensa</option>
                <option value="REVOKED">Revogada</option>
                <option value="EXPIRED">Expirada</option>
              </select>
              <button type="submit">Filtrar</button>
            </form>
            {licenses.length === 0 ? <p className="admin-note">Nenhum registro neste recorte.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Produto</th>
                      <th>Origem</th>
                      <th>Modalidade</th>
                      <th>Status</th>
                      <th>Ativação</th>
                      <th>Expiração</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((license) => (
                      <tr key={license.id}>
                        <td>{license.userName}<br />{license.email}</td>
                        <td>{license.product}</td>
                        <td>{label(SOURCE, license.source)}</td>
                        <td>{license.term === "LIFETIME" ? "Vitalícia" : "Com validade"}</td>
                        <td>{label(STATUS, license.status)}</td>
                        <td>{when(license.activatedAt)}</td>
                        <td>{license.term === "LIFETIME" ? "Sem expiração" : when(license.expiresAt)}</td>
                        <td><button onClick={() => void openLicense(license.id)} type="button">Detalhe</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager limit={20} onPage={setLicensePage} page={licensePage} total={licenseTotal} />
            {selected ? (
              <div className="admin-panel">
                <h2>Histórico da licença</h2>
                <p>{selected.userName} · {label(STATUS, selected.status)} · {label(SOURCE, selected.source)}</p>
                {selected.grant ? <p>Concessão {label(CATEGORY, selected.grant.category)} por {selected.grant.actorName}. {selected.grant.reason}</p> : null}
                {selected.redemption ? <p>Originada por voucher em {when(selected.redemption.at)}.</p> : null}
                {selected.payments.length === 0 ? <p>Sem pagamento associado.</p> : selected.payments.map((payment) => (
                  <p key={payment.id}>{label(STATUS, payment.status)} · {payment.providerPaymentId || "sem id do provedor"}</p>
                ))}
                <ul>
                  {selected.events.length === 0 ? <li>Nenhum evento administrativo.</li> : selected.events.map((event) => (
                    <li key={event.id}>{when(event.createdAt)} · {event.summary}</li>
                  ))}
                </ul>
                <form
                  className="admin-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                  }}
                >
                  <textarea
                    aria-label="Justificativa"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Justificativa da alteração"
                    value={reason}
                  />
                  {selected.status === "ACTIVE" ? <button onClick={() => void mutate("suspend")} type="button">Suspender</button> : null}
                  {selected.status === "SUSPENDED" ? <button onClick={() => void mutate("restore")} type="button">Restaurar</button> : null}
                  {selected.status === "ACTIVE" || selected.status === "SUSPENDED" ? (
                    <button onClick={() => void mutate("revoke")} type="button">Revogar</button>
                  ) : null}
                </form>
              </div>
            ) : null}
          </div>
        ) : null}
        {tab === "payments" ? (
          <div className="admin-panel">
            <p>Aprovado: {money(overview.approvedPayments)}</p>
            <p>Pendente, fora da receita: {money(overview.pendingPayments)}</p>
            <p>Reembolsado ou contestado: {money(overview.refundedPayments)}</p>
            <p>Recusado: {money(overview.rejectedPayments)}</p>
            {payments.length === 0 ? <p className="admin-note">Nenhum registro neste recorte.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Pagamento</th>
                      <th>Licença</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.userName}</td>
                        <td>{money([{ currency: payment.currency, amountMinor: payment.amountMinor, count: 1 }])}</td>
                        <td>{label(STATUS, payment.status)}{payment.providerStatus ? ` (${payment.providerStatus})` : ""}</td>
                        <td>{when(payment.createdAt)}</td>
                        <td>{payment.providerPaymentId || "—"}</td>
                        <td>{payment.licenseId || "—"}</td>
                        <td>
                          <button onClick={() => void openPayment(payment.id)} type="button">Eventos</button>
                          {payment.providerPaymentId ? (
                            <button
                              onClick={() => void syncAdminPayment(payment.id).then(async () => {
                                await load();
                                if (paymentDetail?.id === payment.id) await openPayment(payment.id);
                              }).catch((caught: unknown) => setError(adminError(caught)))}
                              type="button"
                            >
                              Sincronizar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager limit={paymentLimit} onPage={setPaymentPage} page={paymentPage} total={paymentTotal} />
            {paymentDetail ? (
              <section>
                <h2>Eventos confirmados</h2>
                <p>
                  {paymentDetail.userName} · {label(STATUS, paymentDetail.status)}
                  {paymentDetail.providerStatus ? ` · provedor ${paymentDetail.providerStatus}` : ""}
                </p>
                {paymentDetail.events.length === 0 ? (
                  <p className="admin-note">Nenhum evento do provedor foi persistido para este pagamento.</p>
                ) : (
                  <ol>
                    {paymentDetail.events.map((event) => (
                      <li key={event.id}>
                        {when(event.createdAt)} · {label(PAYMENT_EVENT, event.type)} · {event.provider}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
        {tab === "vouchers" ? (
          <>
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                setVoucherPage(1);
                setAppliedVoucherSearch(voucherSearch.trim());
                setAppliedVoucherStatus(voucherStatus);
              }}
            >
              <input
                aria-label="Pesquisar voucher"
                onChange={(event) => setVoucherSearch(event.target.value)}
                placeholder="Prefixo ou campanha"
                value={voucherSearch}
              />
              <select
                aria-label="Status do voucher"
                onChange={(event) => setVoucherStatus(event.target.value)}
                value={voucherStatus}
              >
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
                <option value="EXHAUSTED">Esgotado</option>
                <option value="CLOSED">Encerrado</option>
                <option value="EXPIRED">Expirado</option>
                <option value="SCHEDULED">Agendado</option>
              </select>
              <button type="submit">Filtrar</button>
            </form>
            <VoucherPanel
              created={created}
              onCreated={setCreated}
              onError={(message) => setError(message)}
              onOpenDetail={(id) => {
                void getAdminVoucher(id)
                  .then(setVoucherDetail)
                  .catch((caught: unknown) => setError(adminError(caught)));
              }}
              onReload={() => void load()}
              vouchers={vouchers}
            />
            <Pager limit={voucherLimit} onPage={setVoucherPage} page={voucherPage} total={voucherTotal} />
            {voucherDetail ? (
              <section className="admin-panel">
                <h2>Resgates do voucher {voucherDetail.codePrefix}</h2>
                <p>
                  {label(STATUS, voucherDetail.status)} · {voucherDetail.redeemedCount}/{voucherDetail.maxRedemptions} usos ·
                  restantes {voucherDetail.remaining}
                </p>
                {voucherDetail.notes ? <p>Observações: {voucherDetail.notes}</p> : null}
                {voucherDetail.redemptions.length === 0 ? (
                  <p className="admin-note">Nenhum resgate registrado.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Usuário</th>
                          <th>Resultado</th>
                          <th>Motivo</th>
                          <th>Licença</th>
                          <th>Quando</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voucherDetail.redemptions.map((row) => (
                          <tr key={row.id}>
                            <td>{row.userName}<br />{row.email}</td>
                            <td>{row.result}</td>
                            <td>{row.reason || "—"}</td>
                            <td>{row.licenseId || "—"}</td>
                            <td>{when(row.at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={() => setVoucherDetail(null)} type="button">Fechar detalhe</button>
              </section>
            ) : null}
          </>
        ) : null}
        {tab === "grant" ? (
          <div className="admin-panel">
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!reviewing) {
                  setReviewing(true);
                  return;
                }
                if (chosen) {
                  void grantAdminLicense({
                    userId: chosen.id,
                    term: grantTerm,
                    durationDays: grantTerm === "FIXED" ? Number(grantDays) : undefined,
                    category: grantCategory,
                    reason: grantReason,
                  })
                    .then(() => {
                      setNotice("Licença concedida. Nenhum pagamento foi criado.");
                      setReviewing(false);
                      setGrantReason("");
                      setChosen(null);
                      void load();
                    })
                    .catch((caught: unknown) => setError(adminError(caught)));
                  return;
                }
                if (pendingEmail.trim()) {
                  void schedulePendingGrant({
                    email: pendingEmail.trim(),
                    term: grantTerm,
                    durationDays: grantTerm === "FIXED" ? Number(grantDays) : undefined,
                    category: grantCategory,
                    reason: grantReason,
                  })
                    .then(() => {
                      setNotice(
                        "Oferta pendente registrada. A licença só é criada quando este e-mail autenticar no RuneCodex.",
                      );
                      setReviewing(false);
                      setGrantReason("");
                      setPendingEmail("");
                      void load();
                    })
                    .catch((caught: unknown) => setError(adminError(caught)));
                }
              }}
            >
              <h2>Conceder licença</h2>
              <p className="admin-note">
                Se a conta ainda não existir, registre uma oferta pendente. Digitar o e-mail não libera Premium;
                a licença só nasce depois que essa pessoa autenticar com o mesmo e-mail.
              </p>
              <input
                aria-label="Pesquisar usuário"
                onChange={(event) => {
                  const value = event.target.value;
                  setPendingEmail(value);
                  setChosen(null);
                  setReviewing(false);
                  if (value.trim().length < 2) {
                    setUsers([]);
                    return;
                  }
                  void searchLicenseUsers(value).then(setUsers).catch((caught: unknown) => setError(adminError(caught)));
                }}
                placeholder="E-mail ou personagem"
                value={pendingEmail}
              />
              <ul>
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => {
                        setChosen(user);
                        setPendingEmail(user.email);
                        setReviewing(false);
                      }}
                      type="button"
                    >
                      {user.name || user.email} · {user.email}
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                {chosen
                  ? `Conta selecionada: ${chosen.email}`
                  : pendingEmail.trim()
                    ? `Sem conta encontrada. Será criada oferta pendente para ${pendingEmail.trim().toLowerCase()}.`
                    : "Nenhuma conta selecionada."}
              </p>
              <select aria-label="Modalidade" onChange={(event) => setGrantTerm(event.target.value as "LIFETIME" | "FIXED")} value={grantTerm}>
                <option value="LIFETIME">Vitalícia</option>
                <option value="FIXED">Com validade</option>
              </select>
              {grantTerm === "FIXED" ? (
                <input aria-label="Duração em dias" min={1} onChange={(event) => setGrantDays(event.target.value)} type="number" value={grantDays} />
              ) : null}
              <select aria-label="Categoria" onChange={(event) => setGrantCategory(event.target.value)} value={grantCategory}>
                {Object.entries(CATEGORY).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <textarea aria-label="Justificativa da concessão" minLength={8} onChange={(event) => setGrantReason(event.target.value)} required value={grantReason} />
              {reviewing ? (
                <p>
                  Confirmar {label(CATEGORY, grantCategory)} para {chosen?.email || pendingEmail.trim()}, produto RUNECODEX_PREMIUM,{" "}
                  {grantTerm === "LIFETIME" ? "vitalícia" : `${grantDays} dias`}
                  {chosen ? "." : " como oferta pendente."}
                </p>
              ) : null}
              <button
                disabled={(!chosen && pendingEmail.trim().length < 5) || grantReason.trim().length < 8}
                type="submit"
              >
                {reviewing ? "Confirmar concessão" : "Revisar"}
              </button>
            </form>
            <h2>Ofertas pendentes</h2>
            {pendingRows.length === 0 ? <p className="admin-note">Nenhuma oferta pendente.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>E-mail</th>
                      <th>Categoria</th>
                      <th>Modalidade</th>
                      <th>Validade da oferta</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.email}</td>
                        <td>{label(CATEGORY, row.category)}</td>
                        <td>{row.term === "LIFETIME" ? "Vitalícia" : `${row.durationDays ?? "?"} dias`}</td>
                        <td>{when(row.offerExpiresAt)}</td>
                        <td>
                          <button
                            onClick={() => {
                              const cancelReason = window.prompt("Motivo do cancelamento (mín. 8 caracteres)");
                              if (!cancelReason || cancelReason.trim().length < 8) return;
                              void cancelPendingGrant(row.id, cancelReason.trim())
                                .then(() => {
                                  setNotice("Oferta pendente cancelada.");
                                  void load();
                                })
                                .catch((caught: unknown) => setError(adminError(caught)));
                            }}
                            type="button"
                          >
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
        {tab === "history" ? (
          activity.length === 0 ? <p className="admin-note">Nenhum registro neste recorte.</p> : (
            <ul className="admin-panel">
              {activity.map((event) => (
                <li key={event.id}>{when(event.createdAt)} · {event.summary}</li>
              ))}
            </ul>
          )
        ) : null}
      </AdminState>
    </>
  );
}

function OverviewCards({ overview }: { overview: LicenseOverview }) {
  const cards = [
    ["Licenças ativas", String(overview.activeLicenses)],
    ["Vitalícias", String(overview.lifetimeLicenses)],
    ["Com validade", String(overview.fixedLicenses)],
    ["Concedidas gratuitamente", String(overview.grantedLicenses)],
    ["Compradas", String(overview.purchasedLicenses)],
    ["Por voucher", String(overview.voucherLicenses)],
    ["Parceria", String(overview.partnershipLicenses)],
    ["Pagamentos aprovados", money(overview.approvedPayments)],
    ["Pagamentos pendentes", money(overview.pendingPayments)],
    ["Recusados", money(overview.rejectedPayments)],
    ["Reembolsados ou contestados", money(overview.refundedPayments)],
    ["Vouchers ativos", String(overview.activeVouchers)],
    ["Resgates", String(overview.redemptions)],
    ["Desconto comercial", overview.commercialDiscount.available ? "Disponível" : "Não disponível"],
  ];
  return (
    <div className="admin-metrics">
      {cards.map(([labelText, value]) => (
        <article className="admin-metric" key={labelText}>
          <p>{labelText}</p>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function VoucherPanel({
  vouchers,
  created,
  onCreated,
  onReload,
  onError,
  onOpenDetail,
}: {
  vouchers: AdminVoucher[];
  created: CreatedVoucher | null;
  onCreated: (voucher: CreatedVoucher) => void;
  onReload: () => void;
  onError: (message: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  const [benefit, setBenefit] = useState("FREE");
  const [term, setTerm] = useState<"LIFETIME" | "FIXED">("LIFETIME");
  const [days, setDays] = useState("30");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [campaign, setCampaign] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="admin-panel">
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createAdminVoucher({
            benefit,
            term,
            durationDays: term === "FIXED" ? Number(days) : undefined,
            maxRedemptions: Number(maxRedemptions),
            perUserLimit: Number(perUserLimit),
            startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
            endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
            campaign: campaign || undefined,
            notes: notes || undefined,
          })
            .then((voucher) => {
              onCreated(voucher);
              onReload();
            })
            .catch((caught: unknown) => onError(caught instanceof ApiError ? caught.message : adminError(caught)));
        }}
      >
        <h2>Novo voucher</h2>
        <select aria-label="Tipo do voucher" onChange={(event) => setBenefit(event.target.value)} value={benefit}>
          <option value="FREE">Licença gratuita</option>
          <option value="PARTNERSHIP">Licença de parceria</option>
          <option value="PROMOTIONAL">Licença promocional</option>
        </select>
        <select aria-label="Modalidade do voucher" onChange={(event) => setTerm(event.target.value as "LIFETIME" | "FIXED")} value={term}>
          <option value="LIFETIME">Vitalícia</option>
          <option value="FIXED">Com validade</option>
        </select>
        {term === "FIXED" ? <input aria-label="Dias do voucher" min={1} onChange={(event) => setDays(event.target.value)} type="number" value={days} /> : null}
        <input aria-label="Máximo de resgates" min={1} onChange={(event) => setMaxRedemptions(event.target.value)} type="number" value={maxRedemptions} />
        <input aria-label="Limite por usuário" min={1} onChange={(event) => setPerUserLimit(event.target.value)} type="number" value={perUserLimit} />
        <label>
          Início
          <input aria-label="Início do voucher" onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} />
        </label>
        <label>
          Expiração
          <input aria-label="Expiração do voucher" onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" value={endsAt} />
        </label>
        <input aria-label="Campanha" onChange={(event) => setCampaign(event.target.value)} placeholder="Campanha / categoria" value={campaign} />
        <textarea aria-label="Observações internas" onChange={(event) => setNotes(event.target.value)} placeholder="Justificativa ou observações internas" value={notes} />
        <button type="submit">Criar voucher</button>
      </form>
      {created ? (
        <div className="admin-panel" role="status">
          <p>Código gerado: <strong>{created.code}</strong></p>
          <p>Este código não será exibido novamente. O banco guarda apenas o hash.</p>
          <button
            onClick={() => void navigator.clipboard.writeText(created.code)}
            type="button"
          >
            Copiar código
          </button>
        </div>
      ) : null}
      {vouchers.length === 0 ? <p className="admin-note">Nenhum registro neste recorte.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Prefixo</th>
                <th>Tipo</th>
                <th>Campanha</th>
                <th>Status</th>
                <th>Usos</th>
                <th>Restantes</th>
                <th>Período</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>{voucher.codePrefix}</td>
                  <td>{voucher.benefit}</td>
                  <td>{voucher.campaign || "—"}</td>
                  <td>{label(STATUS, voucher.status)}</td>
                  <td>{voucher.redeemedCount}/{voucher.maxRedemptions}</td>
                  <td>{voucher.remaining}</td>
                  <td>{when(voucher.startsAt)} – {when(voucher.endsAt)}</td>
                  <td>
                    <button onClick={() => onOpenDetail(voucher.id)} type="button">Detalhe</button>
                    {voucher.storedStatus === "ACTIVE" ? <button onClick={() => void changeAdminVoucher(voucher.id, "pause").then(onReload)} type="button">Pausar</button> : null}
                    {voucher.storedStatus === "PAUSED" ? <button onClick={() => void changeAdminVoucher(voucher.id, "resume").then(onReload)} type="button">Reativar</button> : null}
                    {voucher.storedStatus === "ACTIVE" || voucher.storedStatus === "PAUSED" ? <button onClick={() => void changeAdminVoucher(voucher.id, "close").then(onReload)} type="button">Encerrar</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
