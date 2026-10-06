import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { SearchInput } from "../components/ui/FormControls";
import { useLatestRequest } from "../hooks/useLatestRequest";
import {
  BESTIARY_DIFFICULTIES,
  bestiaryApiDifficulty,
  filterBestiary,
  formatBestiaryKills,
  mapBestiaryEntry,
  type BestiaryDifficultyFilter,
} from "../domain/bestiary";
import { formatCount } from "../domain/format";
import { describeApiError } from "../services/api/errors";
import { listFilteredBestiary } from "../services/api/bestiary";
import type { BestiaryEntry } from "../services/api/types";

export function BestiaryPage() {
  const { isAuthenticated, isReady } = useAuth();
  const requests = useLatestRequest();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<BestiaryDifficultyFilter>("All");
  const [entries, setEntries] = useState<BestiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEntries = useCallback(async () => {
    const current = requests.start();
    setLoading(true);
    setError("");
    try {
      const items = await listFilteredBestiary(
        { difficulty: bestiaryApiDifficulty(difficulty) },
        isAuthenticated,
      );
      if (!current()) return;
      setEntries(items.map(mapBestiaryEntry));
    } catch (err) {
      if (!current()) return;
      setEntries([]);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [difficulty, isAuthenticated, requests]);

  useEffect(() => {
    if (!isReady) return;
    void loadEntries();
  }, [isReady, loadEntries]);

  const filtered = useMemo(
    () => filterBestiary(entries, query, "All"),
    [entries, query],
  );

  return (
    <div className="catalog-page catalog-page--bestiary">
      <section className="catalog-hero catalog-hero--bestiary" aria-labelledby="bestiary-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <span className="eyebrow">Bestiário</span>
          <h1 id="bestiary-title">Criaturas e progresso</h1>
          <p>
            {isAuthenticated
              ? "O progresso de kills vem da sua conta quando a API o envia."
              : "Entre na conta para ver o progresso do bestiário."}
          </p>
        </PageContainer>
      </section>

      <PageContainer className="catalog-body" size="wide">
        <div className="catalog-filters">
          <SearchInput
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar criatura, local ou grupo"
            value={query}
          />
          <div className="chip-row" aria-label="Dificuldade">
            {BESTIARY_DIFFICULTIES.map((item) => (
              <Chip
                active={difficulty === item}
                key={item}
                onClick={() => setDifficulty(item)}
              >
                {item}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando bestiário" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void loadEntries()} />
        ) : filtered.length === 0 ? (
          <CatalogEmpty
            action={
              <Button onClick={() => void loadEntries()} variant="secondary">
                Recarregar
              </Button>
            }
            description={
              entries.length === 0
                ? "A API não retornou criaturas para este filtro."
                : "Nenhuma criatura corresponde à busca."
            }
            title="Nenhuma criatura encontrada"
          />
        ) : (
          <div className="catalog-grid catalog-grid--bestiary">
            {filtered.map((entry) => (
              <Link className="catalog-card" key={entry.id || entry.slug} to={`/bestiary/${entry.slug}`}>
                <CatalogImage alt="" className="catalog-card__art" name={entry.name} src={entry.image} />
                <div className="catalog-card__body">
                  <div className="catalog-card__meta">
                    {entry.difficulty ? <Badge>{entry.difficulty}</Badge> : null}
                    {entry.progress?.completed ? <Badge tone="success">Completo</Badge> : null}
                  </div>
                  <h2>{entry.name}</h2>
                  <p>{[entry.location, entry.region].filter(Boolean).join(" · ") || "Local não informado"}</p>
                  <dl className="catalog-card__stats">
                    {formatCount(entry.hp) ? (
                      <div>
                        <dt>HP</dt>
                        <dd>{formatCount(entry.hp)}</dd>
                      </div>
                    ) : null}
                    {formatBestiaryKills(entry) ? (
                      <div>
                        <dt>Kills</dt>
                        <dd>{formatBestiaryKills(entry)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {entry.progress ? (
                    <div className="progress-track" aria-label={`Progresso ${entry.progress.progressPercentage}%`}>
                      <span style={{ width: `${Math.min(100, entry.progress.progressPercentage)}%` }} />
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
