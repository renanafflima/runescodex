import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { BosstiaryProgressPanel } from "../components/bosstiary/BosstiaryProgressPanel";
import { EncyclopediaPanel } from "../components/bosstiary/EncyclopediaPanel";
import { CommunityRotationsFeed } from "../components/bosstiary/CommunityRotationsFeed";
import { loadBosstiaryCatalog, type BosstiaryCatalog } from "../domain/bosstiary-catalog";
import { BOSSTIARY_TABS, parseBosstiaryTab, type BosstiaryTab } from "../domain/bosstiary-rotations";

export function BosstiaryPage() {
  const [params, setParams] = useSearchParams();
  const bossSlug = params.get("boss");
  const tab = parseBosstiaryTab(params.get("tab"));
  const [catalog, setCatalog] = useState<BosstiaryCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const needsCatalog = tab === "enciclopedia";

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

        {tab === "comunidade" ? <CommunityRotationsFeed /> : null}

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
