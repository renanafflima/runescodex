import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/FormControls";
import { Toast } from "../components/ui/Toast";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { formatBestiaryKills, mapBestiaryEntry } from "../domain/bestiary";
import { formatCharmLabel, formatCount } from "../domain/format";
import { describeApiError } from "../services/api/errors";
import { getBestiaryBySlug, updateBestiaryProgress } from "../services/api/bestiary";
import type { BestiaryEntry } from "../services/api/types";

export function BestiaryDetailPage() {
  const { slug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const requests = useLatestRequest();
  const [entry, setEntry] = useState<BestiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kills, setKills] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  const loadEntry = useCallback(async () => {
    const current = requests.start();
    if (!slug) {
      setEntry(null);
      setError("Criatura não encontrada.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getBestiaryBySlug(slug, isAuthenticated);
      if (!current()) return;
      const mapped = mapBestiaryEntry(data);
      setEntry(mapped);
      setKills(mapped.progress ? String(mapped.progress.kills) : "");
    } catch (err) {
      if (!current()) return;
      setEntry(null);
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [isAuthenticated, requests, slug]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  async function handleProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entry) return;
    const nextKills = Number(kills);
    if (!Number.isInteger(nextKills) || nextKills < 0) {
      setNotice({
        title: "Valor inválido",
        message: "Informe um número inteiro de kills.",
        tone: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await updateBestiaryProgress(entry.slug, nextKills);
      await loadEntry();
      setNotice({
        title: "Progresso atualizado",
        message: "As kills foram salvas na sua conta.",
        tone: "success",
      });
    } catch (err) {
      setNotice({
        title: "Não foi possível salvar",
        message: describeApiError(err),
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="catalog-page catalog-page--bestiary">
      {loading ? (
        <PageContainer className="catalog-body" size="wide">
          <CatalogLoading label="Carregando criatura" />
        </PageContainer>
      ) : !entry ? (
        <PageContainer className="catalog-body" size="wide">
          <CatalogError
            description={error || "Esta criatura não foi encontrada."}
            onRetry={() => void loadEntry()}
            title="Criatura indisponível"
          />
          <ButtonLink to="/bestiary" variant="ghost">
            Voltar ao bestiário
          </ButtonLink>
        </PageContainer>
      ) : (
        <>
          <section className="detail-hero detail-hero--bestiary" aria-labelledby="creature-title">
            <PageContainer className="detail-hero__inner" size="wide">
              <ButtonLink to="/bestiary" variant="ghost">
                Voltar
              </ButtonLink>
              <div className="detail-identity">
                <CatalogImage alt="" className="detail-identity__art" name={entry.name} src={entry.image} />
                <div>
                  <span className="eyebrow">Bestiário</span>
                  <h1 id="creature-title">{entry.name}</h1>
                  <p>{[entry.location, entry.region].filter(Boolean).join(" · ")}</p>
                  <div className="detail-hero__badges">
                    {entry.difficulty ? <Badge tone="gold">{entry.difficulty}</Badge> : null}
                    {entry.progress?.completed ? <Badge tone="success">Completo</Badge> : null}
                  </div>
                </div>
              </div>
            </PageContainer>
          </section>

          <PageContainer className="catalog-body detail-body" size="wide">
            {entry.description ? <p className="detail-copy">{entry.description}</p> : null}

            <div className="detail-stats-grid">
              <Card>
                <h2>Status</h2>
                <dl className="catalog-card__stats">
                  {formatCount(entry.hp) ? (
                    <div>
                      <dt>HP</dt>
                      <dd>{formatCount(entry.hp)}</dd>
                    </div>
                  ) : null}
                  {formatCount(entry.experience) ? (
                    <div>
                      <dt>XP</dt>
                      <dd>{formatCount(entry.experience)}</dd>
                    </div>
                  ) : null}
                  {formatBestiaryKills(entry) ? (
                    <div>
                      <dt>Kills</dt>
                      <dd>{formatBestiaryKills(entry)}</dd>
                    </div>
                  ) : null}
                  {formatCount(entry.estimatedHours) ? (
                    <div>
                      <dt>Horas</dt>
                      <dd>{formatCount(entry.estimatedHours)}</dd>
                    </div>
                  ) : null}
                </dl>
              </Card>

              {entry.progress ? (
                <Card>
                  <h2>Progresso</h2>
                  <div className="progress-track progress-track--lg" aria-label={`Progresso ${entry.progress.progressPercentage}%`}>
                    <span style={{ width: `${Math.min(100, entry.progress.progressPercentage)}%` }} />
                  </div>
                  <p>{entry.progress.progressPercentage}% completo</p>
                </Card>
              ) : null}
            </div>

            {entry.weaknesses.length ? (
              <Card className="detail-section">
                <h2>Fraquezas</h2>
                <div className="chip-row">
                  {entry.weaknesses.map((item) => (
                    <Badge key={item}>{formatCharmLabel(item)}</Badge>
                  ))}
                </div>
              </Card>
            ) : null}

            {entry.killTogether.length ? (
              <Card className="detail-section">
                <h2>Caçar junto</h2>
                <p>{entry.killTogether.join(", ")}</p>
              </Card>
            ) : null}

            {entry.youtubeUrl ? (
              <Card className="detail-section">
                <h2>Vídeo</h2>
                <a href={entry.youtubeUrl} rel="noreferrer" target="_blank">
                  Assistir no YouTube
                </a>
              </Card>
            ) : null}

            {entry.killsRequired != null && isAuthenticated ? (
              <Card className="detail-section">
                <h2>Atualizar kills</h2>
                <p>O progresso não pode diminuir. Informe o total atual de kills.</p>
                <form className="progress-form" onSubmit={handleProgress}>
                  <Input
                    label="Kills"
                    min={0}
                    onChange={(event) => setKills(event.target.value)}
                    type="number"
                    value={kills}
                  />
                  <Button loading={saving} type="submit">
                    Salvar progresso
                  </Button>
                </form>
              </Card>
            ) : null}
            {entry.killsRequired != null && !isAuthenticated ? (
              <Card className="detail-section">
                <h2>Progresso</h2>
                <p>Entre na conta para registrar as kills desta criatura.</p>
                <ButtonLink to="/login" variant="secondary">
                  Entrar
                </ButtonLink>
              </Card>
            ) : null}
          </PageContainer>
        </>
      )}

      {notice ? (
        <div className="toast-region">
          <Toast
            message={notice.message}
            onClose={() => setNotice(null)}
            title={notice.title}
            tone={notice.tone}
          />
        </div>
      ) : null}
    </div>
  );
}
