import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError, describeApiError } from "../../services/api/errors";
import { getAdminBadges, searchAdmin, type AdminMetric } from "../../services/api/admin-portal";
import "../../styles/admin.css";

const GROUPS = [
  {
    label: "Operação",
    items: [
      { to: "/admin", label: "Visão geral", end: true },
      { to: "/admin/analytics", label: "Analytics" },
      { to: "/admin/rankings", label: "Rankings" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/admin/users", label: "Usuários" },
      { to: "/admin/licenses", label: "Licenças" },
      { to: "/admin/referrals", label: "Indicações" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { to: "/admin/hunts", label: "Hunts" },
      { to: "/admin/bestiary", label: "Bestiário" },
      { to: "/admin/bosses", label: "Bosses" },
    ],
  },
  {
    label: "Comunidade",
    items: [
      { to: "/admin/forum", label: "Fórum" },
      { to: "/admin/contributions", label: "Contribuições", badge: "contributions" as const },
      { to: "/admin/rewards", label: "Recompensas", badge: "redemptions" as const },
    ],
  },
  {
    label: "Atendimento",
    items: [{ to: "/admin/tickets", label: "Chamados", badge: "openTickets" as const }],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/audit", label: "Auditoria" },
      { to: "/admin/access", label: "Acesso" },
      { to: "/admin/settings", label: "Configurações" },
    ],
  },
];

const CRUMBS: Record<string, string> = {
  admin: "Portal",
  tickets: "Chamados",
  hunts: "Hunts",
  bestiary: "Bestiário",
  bosses: "Bosses",
  forum: "Fórum",
  users: "Usuários",
  analytics: "Analytics",
  rankings: "Rankings",
  contributions: "Contribuições",
  rewards: "Recompensas",
  licenses: "Licenças",
  referrals: "Indicações",
  audit: "Auditoria",
  access: "Acesso",
  settings: "Configurações",
};

const HIT_LABEL = {
  user: "Usuário",
  creature: "Criatura",
  hunt: "Hunt",
  ticket: "Chamado",
};

const PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "custom", label: "Personalizado" },
];

export function useAdminPeriod() {
  const [params, setParams] = useSearchParams();
  const preset = params.get("preset") || "30d";
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  function update(next: Record<string, string>) {
    const copy = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) copy.set(key, value);
      else copy.delete(key);
    }
    setParams(copy);
  }

  const query = useMemo(() => {
    if (preset !== "custom") return { preset };
    if (!from || !to) return { preset };
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { preset };
    return { preset, from: start.toISOString(), to: end.toISOString() };
  }, [from, preset, to]);

  return {
    preset,
    from,
    to,
    query,
    ready: preset !== "custom" || Boolean(from && to),
    setPreset(next: string) {
      update({ preset: next, from: next === "custom" ? from : "", to: next === "custom" ? to : "" });
    },
    setFrom(value: string) {
      update({ preset: "custom", from: value, to });
    },
    setTo(value: string) {
      update({ preset: "custom", to: value, from });
    },
  };
}

export function AdminShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [badges, setBadges] = useState({ openTickets: 0, unassigned: 0, contributions: 0, redemptions: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ type: keyof typeof HIT_LABEL; id: string; label: string; href: string }>>([]);
  const crumb = useMemo(
    () =>
      location.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => CRUMBS[part] || "Detalhe")
        .join(" / "),
    [location.pathname],
  );

  useEffect(() => {
    let active = true;
    void getAdminBadges()
      .then((next) => {
        if (active) setBadges(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setHits([]);
    setQuery("");
  }, [location.pathname]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchAdmin(term)
        .then((result) => {
          if (active) setHits(result.items);
        })
        .catch(() => {
          if (active) setHits([]);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="admin-shell">
      <div className="admin-sidebar">
        <button className="admin-nav-toggle" onClick={() => setMenuOpen((open) => !open)} type="button">
          {menuOpen ? "Fechar menu" : "Menu"}
        </button>
        <nav aria-label="Administração" className={menuOpen ? "admin-nav admin-nav--open" : "admin-nav"}>
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="admin-nav__group">{group.label}</p>
              {group.items.map((item) => {
                const count = "badge" in item && item.badge ? badges[item.badge] : 0;
                return (
                  <NavLink end={"end" in item ? item.end : false} key={item.to} to={item.to}>
                    <span>{item.label}</span>
                    {count > 0 ? <span className="admin-nav__count">{count}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="admin-page">
        <header className="admin-top">
          <p className="admin-crumb">{crumb}</p>
          <form className="admin-search" onSubmit={(event) => event.preventDefault()}>
            <input
              aria-label="Busca administrativa"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Usuário, criatura, hunt ou chamado"
              value={query}
            />
            {hits.length > 0 ? (
              <ul>
                {hits.map((hit) => (
                  <li key={`${hit.type}-${hit.id}`}>
                    <Link to={hit.href}>
                      <span>{HIT_LABEL[hit.type]}</span>
                      {hit.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
          <div className="admin-top__account">
            <span>{user?.email || "Administrador"}</span>
            <button onClick={() => void logout()} type="button">Sair</button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

export function PeriodFilters() {
  const period = useAdminPeriod();
  return (
    <div className="admin-filters">
      <label>
        Período
        <select onChange={(event) => period.setPreset(event.target.value)} value={period.preset}>
          {PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {period.preset === "custom" ? (
        <>
          <label>
            De
            <input onChange={(event) => period.setFrom(event.target.value)} type="datetime-local" value={period.from} />
          </label>
          <label>
            Até
            <input onChange={(event) => period.setTo(event.target.value)} type="datetime-local" value={period.to} />
          </label>
        </>
      ) : null}
    </div>
  );
}

export function formatAdminNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatDelta(value: number | null) {
  if (value === null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

const WINDOW_LABEL = {
  snapshot: "agora",
  period: "no período",
  cumulative: "acumulado",
};

export function MetricGrid({ metrics }: { metrics: AdminMetric[] }) {
  return (
    <section className="admin-metrics">
      {metrics.map((metric) => {
        const delta = formatDelta(metric.deltaPercent);
        return (
          <article className="admin-metric" key={metric.key} title={metric.definition}>
            <header>
              <span>{metric.label}</span>
              <span>{WINDOW_LABEL[metric.window]}</span>
            </header>
            <strong>{formatAdminNumber(metric.value)}</strong>
            {delta ? (
              <span className={metric.deltaPercent! < 0 ? "admin-delta--down" : "admin-delta--up"}>{delta} vs. período anterior</span>
            ) : (
              <span className="admin-delta--flat">Sem variação calculada</span>
            )}
            {metric.unavailableReason ? <p>{metric.unavailableReason}</p> : <p>{metric.definition}</p>}
            <Link to={metric.href}>Abrir</Link>
          </article>
        );
      })}
    </section>
  );
}

export function TrendChart({ buckets }: { buckets: Array<{ start: string; value: number | null }> }) {
  const values = buckets.map((bucket) => bucket.value);
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) {
    return <p className="admin-note">Não há pontos medidos neste período.</p>;
  }
  const max = Math.max(...numbers, 1);
  const width = 640;
  const height = 180;
  const step = buckets.length > 1 ? width / (buckets.length - 1) : width;
  const points = buckets
    .map((bucket, index) => {
      if (bucket.value === null) return null;
      const x = index * step;
      const y = height - (bucket.value / max) * (height - 16) - 8;
      return `${x},${y}`;
    })
    .filter((point): point is string => Boolean(point))
    .join(" ");
  return (
    <svg aria-label="Série temporal" className="admin-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} />
    </svg>
  );
}

export function AdminState({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="admin-metrics" aria-busy="true">
        <div className="admin-skeleton" />
        <div className="admin-skeleton" />
        <div className="admin-skeleton" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="admin-panel" role="alert">
        <p>{error}</p>
        <button onClick={onRetry} type="button">
          Tentar novamente
        </button>
      </div>
    );
  }
  if (empty) return <p className="admin-note">Nenhum registro neste recorte.</p>;
  return children;
}

export function adminError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Entre com uma conta de administrador.";
    if (error.status === 403) return "Você não tem permissão para esta área.";
    if (error.status === 409) return "O registro mudou. Atualize a tela e tente de novo.";
    return error.message || describeApiError(error);
  }
  return describeApiError(error);
}

export function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="admin-actions">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} type="button">
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} type="button">
        Próxima
      </button>
    </div>
  );
}
