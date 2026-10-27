import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../services/api/errors";
import {
  changeAdminLicense,
  changeAdminVoucher,
  createAdminVoucher,
  getAdminLicense,
  getAdminPayment,
  getLicenseActivity,
  getLicenseOverview,
  grantAdminLicense,
  listAdminLicenses,
  listAdminPayments,
  listAdminVouchers,
  searchLicenseUsers,
  syncAdminPayment,
  type AdminLicense,
  type AdminPayment,
  type AdminPaymentEvent,
  type AdminVoucher,
  type CreatedVoucher,
  type LicenseOverview,
  type LicenseUser,
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
  const [created, setCreated] = useState<CreatedVoucher | null>(null);
  const [activity, setActivity] = useState<Array<{ id: string; action: string; summary: string; createdAt: string }>>([]);
  const [users, setUsers] = useState<LicenseUser[]>([]);
  const [chosen, setChosen] = useState<LicenseUser | null>(null);
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
        const page = await listAdminVouchers(voucherPage);
        setVouchers(page.items);
        setVoucherTotal(page.total);
        setVoucherLimit(page.limit);
      } else if (tab === "history") {
        setActivity(await getLicenseActivity());
      }
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedStatus, licensePage, paymentPage, tab, voucherPage]);

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
            <VoucherPanel
              created={created}
              onCreated={setCreated}
              onError={(message) => setError(message)}
              onReload={() => void load()}
              vouchers={vouchers}
            />
            <Pager limit={voucherLimit} onPage={setVoucherPage} page={voucherPage} total={voucherTotal} />
          </>
        ) : null}
        {tab === "grant" ? (
          <form
            className="admin-form admin-panel"
            onSubmit={(event) => {
              event.preventDefault();
              if (!reviewing) {
                setReviewing(true);
                return;
              }
              if (!chosen) return;
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
                })
                .catch((caught: unknown) => setError(adminError(caught)));
            }}
          >
            <h2>Conceder licença</h2>
            <input
              aria-label="Pesquisar usuário"
              onChange={(event) => {
                const value = event.target.value;
                if (value.trim().length < 2) {
                  setUsers([]);
                  return;
                }
                void searchLicenseUsers(value).then(setUsers).catch((caught: unknown) => setError(adminError(caught)));
              }}
              placeholder="E-mail ou personagem"
            />
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  <button onClick={() => { setChosen(user); setReviewing(false); }} type="button">
                    {user.name || user.email} · {user.email}
                  </button>
                </li>
              ))}
            </ul>
            <p>Selecionado: {chosen ? chosen.email : "nenhum"}</p>
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
            {reviewing && chosen ? (
              <p>
                Confirmar {label(CATEGORY, grantCategory)} para {chosen.email}, produto RUNECODEX_PREMIUM, {grantTerm === "LIFETIME" ? "vitalícia" : `${grantDays} dias`}.
              </p>
            ) : null}
            <button disabled={!chosen || grantReason.trim().length < 8} type="submit">
              {reviewing ? "Confirmar concessão" : "Revisar"}
            </button>
          </form>
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
}: {
  vouchers: AdminVoucher[];
  created: CreatedVoucher | null;
  onCreated: (voucher: CreatedVoucher) => void;
  onReload: () => void;
  onError: (message: string) => void;
}) {
  const [benefit, setBenefit] = useState("FREE");
  const [term, setTerm] = useState<"LIFETIME" | "FIXED">("LIFETIME");
  const [days, setDays] = useState("30");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [perUserLimit, setPerUserLimit] = useState("1");
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
        <input aria-label="Campanha" onChange={(event) => setCampaign(event.target.value)} placeholder="Campanha" value={campaign} />
        <textarea aria-label="Observações internas" onChange={(event) => setNotes(event.target.value)} placeholder="Observações internas" value={notes} />
        <button type="submit">Criar voucher</button>
      </form>
      {created ? (
        <div className="admin-panel" role="status">
          <p>Código gerado: <strong>{created.code}</strong></p>
          <p>Este código não será exibido novamente.</p>
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
                  <td>{label(STATUS, voucher.status)}</td>
                  <td>{voucher.redeemedCount}/{voucher.maxRedemptions}</td>
                  <td>{voucher.remaining}</td>
                  <td>{when(voucher.startsAt)} – {when(voucher.endsAt)}</td>
                  <td>
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
