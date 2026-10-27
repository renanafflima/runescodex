import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminActivity,
  getAdminAlerts,
  getAdminOverview,
  getAdminSeries,
  type AdminMetric,
} from "../../services/api/admin-portal";
import {
  AdminState,
  MetricGrid,
  PeriodFilters,
  TrendChart,
  adminError,
  formatAdminDate,
  useAdminPeriod,
} from "./admin-ui";

const SERIES = [
  { id: "signups", label: "Novos cadastros" },
  { id: "activeUsers", label: "Usuários ativos" },
  { id: "contentViews", label: "Visualizações" },
  { id: "huntViews", label: "Hunts acessadas" },
  { id: "forumPosts", label: "Publicações no fórum" },
  { id: "tickets", label: "Chamados criados" },
  { id: "contributions", label: "Contribuições" },
];

export function AdminOverviewPage() {
  const period = useAdminPeriod();
  const [metrics, setMetrics] = useState<AdminMetric[]>([]);
  const [coverage, setCoverage] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState("");
  const [series, setSeries] = useState<Array<{ start: string; value: number | null }>>([]);
  const [seriesNote, setSeriesNote] = useState("");
  const [metric, setMetric] = useState("signups");
  const [activity, setActivity] = useState<Array<{ at: string; type: string; title: string; detail: string; href: string }>>([]);
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; detail: string; href: string; criterion: string }>>([]);
  const [alertNote, setAlertNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!period.ready) {
      setLoading(false);
      setError("Informe o início e o fim do período.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [overview, nextSeries, nextActivity, nextAlerts] = await Promise.all([
        getAdminOverview(period.query),
        getAdminSeries(metric, period.query),
        getAdminActivity(),
        getAdminAlerts(),
      ]);
      setMetrics(overview.metrics);
      setCoverage(overview.coverageStartedAt);
      setMeasurement(overview.viewMeasurement);
      setSeries(nextSeries.buckets);
      setSeriesNote(nextSeries.definition);
      setActivity(nextActivity.items);
      setAlerts(nextAlerts.items);
      const missing = Object.entries(nextAlerts.configured)
        .filter(([, enabled]) => !enabled)
        .map(([key]) => key);
      setAlertNote(
        missing.length
          ? "Alertas de SLA, queda de uso e conteúdo antigo só aparecem depois que o limite é salvo em Configurações. O relógio usado é o tempo corrido."
          : "Os alertas usam tempo corrido e os limites salvos em Configurações.",
      );
    } catch (caught) {
      setError(adminError(caught));
    } finally {
      setLoading(false);
    }
  }, [metric, period.query, period.ready]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="admin-page__head">
        <div>
          <h1>Visão geral</h1>
          <p className="admin-page__lead">
            Cobertura das visualizações: {coverage ? formatAdminDate(coverage) : "ainda sem eventos"}.
            Estado da janela: {measurement || "—"}.
          </p>
        </div>
        <PeriodFilters />
      </header>
      <AdminState error={error} loading={loading} onRetry={() => void load()}>
        <MetricGrid metrics={metrics} />
        <div className="admin-grid">
          <section className="admin-panel">
            <div className="admin-filters">
              <label>
                Série
                <select onChange={(event) => setMetric(event.target.value)} value={metric}>
                  {SERIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="admin-note">{seriesNote}</p>
            <TrendChart buckets={series} />
          </section>
          <section className="admin-panel">
            <h2>Alertas</h2>
            <p className="admin-note">{alertNote}</p>
            {alerts.length === 0 ? (
              <p className="admin-note">Nenhum alerta ativo com os critérios configurados.</p>
            ) : (
              <ul className="admin-alerts">
                {alerts.map((item) => (
                  <li key={item.id}>
                    <Link to={item.href}>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <p>Critério: {item.criterion}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="admin-panel">
          <h2>Atividade recente</h2>
          {activity.length === 0 ? (
            <p className="admin-note">Ainda não há eventos para mostrar.</p>
          ) : (
            <ul className="admin-feed">
              {activity.map((item) => (
                <li key={`${item.type}-${item.at}-${item.title}`}>
                  <Link to={item.href}>
                    <strong>{item.title}</strong>
                    <p>
                      {item.detail} · {formatAdminDate(item.at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminState>
    </>
  );
}
