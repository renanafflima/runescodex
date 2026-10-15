import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { formatEstimatedHours, mapBestiaryEntry, uniqueHuntCreatures } from "../domain/bestiary";
import { formatCount } from "../domain/format";
import { mapHuntListItem } from "../domain/hunts";
import { describeApiError } from "../services/api/errors";
import { getBestiaryBySlug } from "../services/api/bestiary";
import { listFilteredHunts } from "../services/api/hunts";
import type { BestiaryEntry, HuntListItem } from "../services/api/types";

export type BestiaryCreatureOutlet = {
  entry: BestiaryEntry;
  hunts: HuntListItem[];
  isAuthenticated: boolean;
  reload: () => Promise<void>;
};

export function useBestiaryCreature() {
  return useOutletContext<BestiaryCreatureOutlet>();
}

export function BestiaryCreaturePage() {
  const { slug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const requests = useLatestRequest();
  const [entry, setEntry] = useState<BestiaryEntry | null>(null);
  const [hunts, setHunts] = useState<HuntListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCreature = useCallback(async () => {
    const current = requests.start();
    if (!slug) {
      setEntry(null);
      setHunts([]);
      setError("Criatura não encontrada.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [creature, huntItems] = await Promise.all([
        getBestiaryBySlug(slug, isAuthenticated),
        listFilteredHunts({ creature: slug }),
      ]);
      if (!current()) return;
      setEntry(mapBestiaryEntry(creature));
      setHunts(huntItems.map((item) => mapHuntListItem(item)));
    } catch (err) {
      if (!current()) return;
      setEntry(null);
      setHunts([]);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [isAuthenticated, requests, slug]);

  useEffect(() => {
    void loadCreature();
  }, [loadCreature]);

  const involved = useMemo(() => uniqueHuntCreatures(hunts).length, [hunts]);
  const estimatedTime = entry ? formatEstimatedHours(entry.estimatedHours) : null;

  if (loading) {
    return (
      <div className="catalog-page catalog-page--bestiary">
        <PageContainer className="catalog-body" size="wide">
          <CatalogLoading label="Carregando criatura" />
        </PageContainer>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="catalog-page catalog-page--bestiary">
        <PageContainer className="catalog-body" size="wide">
          <CatalogError
            description={error || "Esta criatura não foi encontrada."}
            onRetry={() => void loadCreature()}
            title="Criatura indisponível"
          />
          <ButtonLink to="/bestiary" variant="ghost">
            Voltar ao bestiário
          </ButtonLink>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="catalog-page catalog-page--bestiary">
      <PageContainer className="catalog-body bestiary-creature" size="wide">
        <ButtonLink to="/bestiary" variant="ghost">
          ← Voltar
        </ButtonLink>
        <h1>Caminho de evolução</h1>

        <section className="bestiary-hero" aria-labelledby="creature-title">
          <CatalogImage alt="" className="bestiary-hero__art" name={entry.name} src={entry.image} />
          <div className="bestiary-hero__main">
            <h2 id="creature-title">{entry.name}</h2>
            <p>
              {[entry.location, entry.region].filter(Boolean).join(" · ") ||
                `Veja as hunts e a rota de evolução do ${entry.name}.`}
            </p>
            <div className="bestiary-hero__chips">
              {hunts.length ? <span className="bestiary-chip">{hunts.length} hunts</span> : null}
              {involved ? <span className="bestiary-chip">{involved} criaturas envolvidas</span> : null}
              {formatCount(entry.charmPoints) ? (
                <span className="bestiary-chip">{formatCount(entry.charmPoints)} Charm Points</span>
              ) : null}
              {entry.difficulty ? <Badge>{entry.difficulty}</Badge> : null}
              {entry.progress?.completed ? <Badge tone="success">Completo</Badge> : null}
            </div>
          </div>
          {entry.progress ? (
            <div className="bestiary-hero__progress">
              <div className="bestiary-hero__progress-top">
                <span>Bestiário</span>
                <strong>{entry.progress.kills} / {entry.killsRequired ?? 0}</strong>
              </div>
              <div className="progress-track progress-track--lg" aria-label={`Progresso ${entry.progress.progressPercentage}%`}>
                <span style={{ width: `${Math.min(100, entry.progress.progressPercentage)}%` }} />
              </div>
              <div className="bestiary-hero__percent">{entry.progress.progressPercentage}%</div>
            </div>
          ) : estimatedTime ? (
            <div className="bestiary-hero__progress">
              <div className="bestiary-hero__progress-top">
                <span>Tempo estimado</span>
                <strong>{estimatedTime}</strong>
              </div>
              <p>Referência do bestiário, sem progresso de conta.</p>
            </div>
          ) : null}
        </section>

        <nav className="bestiary-tabs" aria-label="Seções do caminho de evolução">
          <NavLink className={({ isActive }) => `bestiary-tab${isActive ? " is-active" : ""}`} end to={`/bestiary/${entry.slug}`}>
            Rotas recomendadas
          </NavLink>
          <NavLink className={({ isActive }) => `bestiary-tab${isActive ? " is-active" : ""}`} to={`/bestiary/${entry.slug}/hunts`}>
            Todas as hunts
          </NavLink>
        </nav>

        <Outlet
          context={{
            entry,
            hunts,
            isAuthenticated,
            reload: loadCreature,
          } satisfies BestiaryCreatureOutlet}
        />
      </PageContainer>
    </div>
  );
}
