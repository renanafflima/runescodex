import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { BossByLevelPanel } from "../components/bosstiary/BossByLevelPanel";
import { EncyclopediaPanel } from "../components/bosstiary/EncyclopediaPanel";
import { CommunityRotationsFeed } from "../components/bosstiary/CommunityRotationsFeed";
import { RotationsPlanner } from "../components/bosstiary/RotationsPlanner";
import { loadBosstiaryCatalog, type BosstiaryCatalog } from "../domain/bosstiary-catalog";
import { BOSSTIARY_TABS, parseBosstiaryTab, type BosstiaryTab } from "../domain/bosstiary-rotations";

export function BosstiaryPage() {
  const [params, setParams] = useSearchParams();
  const bossSlug = params.get("boss");
  const tab = parseBosstiaryTab(params.get("tab"));
  const [catalog, setCatalog] = useState<BosstiaryCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const needsCatalog = tab === "enciclopedia" || tab === "level";

  function load() {
    setLoading(true);
    setError("");
    try {
      setCatalog(loadBosstiaryCatalog());
    } catch (err) {
      setCatalog(null);
      setError(err instanceof Error ? err.message : "Não foi possível ler o Bosstiário.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!needsCatalog) return;
    if (catalog || error) return;
    load();
  }, [needsCatalog, catalog, error]);

  const entries = useMemo(() => catalog?.entries ?? [], [catalog]);

  function setTab(next: BosstiaryTab) {
    const search = new URLSearchParams(params);
    if (next === "comunidade") search.delete("tab");
    else search.set("tab", next);
    setParams(search, { replace: true });
  }

  if (bossSlug) {
    return <Navigate replace to={`/bosstiary/${bossSlug}`} />;
  }

  return (
    <div className="catalog-page catalog-page--bosstiary">
      <section className="catalog-hero catalog-hero--bosstiary" aria-labelledby="bosstiary-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">Bosstiário</span>
          <h1 id="bosstiary-title">Bosstiário</h1>
          <p>
            Monte rotações de boss com dados revisados, explore faixas por level e consulte a
            enciclopédia de candidatos — separada do Bestiário do RuneCodex.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="catalog-body bosstiary-body" size="wide">
        <nav aria-label="Seções do Bosstiário" className="bosstiary-tabs">
          {BOSSTIARY_TABS.map((item) => (
            <button
              aria-current={tab === item.id ? "page" : undefined}
              className={`bosstiary-tabs__tab${tab === item.id ? " bosstiary-tabs__tab--active" : ""}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "comunidade" ? <CommunityRotationsFeed /> : null}

        {tab === "rotas" ? <RotationsPlanner /> : null}

        {tab === "level" ? (
          loading && !catalog ? (
            <CatalogLoading label="Carregando Bosstiário" />
          ) : error && !catalog ? (
            <CatalogError description={error} onRetry={load} />
          ) : (
            <BossByLevelPanel entries={entries} />
          )
        ) : null}

        {tab === "enciclopedia" ? (
          <EncyclopediaPanel
            entries={entries}
            error={error}
            loading={loading && !catalog}
            onRetry={load}
          />
        ) : null}
      </PageContainer>
    </div>
  );
}
