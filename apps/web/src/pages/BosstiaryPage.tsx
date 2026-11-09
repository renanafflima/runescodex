import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { BossByLevelPanel } from "../components/bosstiary/BossByLevelPanel";
import { BosstiaryProgressPanel } from "../components/bosstiary/BosstiaryProgressPanel";
import { EncyclopediaPanel } from "../components/bosstiary/EncyclopediaPanel";
import { CommunityRotationsFeed } from "../components/bosstiary/CommunityRotationsFeed";
import { PartyPanel } from "../components/bosstiary/PartyPanel";
import { RotationsPlanner } from "../components/bosstiary/RotationsPlanner";
import { loadBosstiaryCatalog, type BosstiaryCatalog } from "../domain/bosstiary-catalog";
import {
  BOSSTIARY_TABS,
  COMMUNITY_INNER_VIEWS,
  parseBosstiaryTab,
  parseCommunityInnerView,
  type BosstiaryTab,
  type CommunityInnerView,
} from "../domain/bosstiary-rotations";

export function BosstiaryPage() {
  const [params, setParams] = useSearchParams();
  const bossSlug = params.get("boss");
  const tab = parseBosstiaryTab(params.get("tab"));
  const communityView = parseCommunityInnerView(params.get("tab"), params.get("view"));
  const [catalog, setCatalog] = useState<BosstiaryCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const needsCatalog = tab === "enciclopedia" || (tab === "comunidade" && communityView === "level");

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
    search.delete("view");
    if (next === "comunidade") search.delete("tab");
    else search.set("tab", next);
    setParams(search, { replace: true });
  }

  function setCommunityView(next: CommunityInnerView) {
    const search = new URLSearchParams(params);
    search.delete("tab");
    if (next === "feed") search.delete("view");
    else search.set("view", next);
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
            Planeje rotações com a comunidade, registre seu progresso pessoal e consulte a
            enciclopédia revisada — sem misturar dados oficiais do Tibia com recomendações do
            RuneCodex.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="catalog-body bosstiary-body" size="wide">
        <nav aria-label="Seções do Bosstiário" className="bosstiary-tabs">
          {BOSSTIARY_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={`bosstiary-tabs__tab${active ? " bosstiary-tabs__tab--active" : ""}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <img alt="" className="bosstiary-tabs__art" src={item.image} />
                <span className="bosstiary-tabs__shade" aria-hidden="true" />
                <span className="bosstiary-tabs__copy">
                  <span className="bosstiary-tabs__kicker">{item.kicker}</span>
                  <span className="bosstiary-tabs__label">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {tab === "comunidade" ? (
          <>
            <nav aria-label="Área da comunidade" className="bosstiary-community-subnav">
              {COMMUNITY_INNER_VIEWS.map((item) => {
                const active = communityView === item.id;
                return (
                  <button
                    aria-current={active ? "page" : undefined}
                    className={`bosstiary-community-subnav__tab${active ? " is-active" : ""}`}
                    key={item.id}
                    onClick={() => setCommunityView(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {communityView === "feed" ? <CommunityRotationsFeed /> : null}
            {communityView === "planner" ? <RotationsPlanner /> : null}
            {communityView === "party" ? <PartyPanel /> : null}
            {communityView === "level" ? (
              loading && !catalog ? (
                <CatalogLoading label="Carregando Bosstiário" />
              ) : error && !catalog ? (
                <CatalogError description={error} onRetry={load} />
              ) : (
                <BossByLevelPanel entries={entries} />
              )
            ) : null}
          </>
        ) : null}

        {tab === "progresso" ? <BosstiaryProgressPanel /> : null}

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
