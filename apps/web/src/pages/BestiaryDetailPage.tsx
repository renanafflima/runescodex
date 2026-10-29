import { type FormEvent, useEffect, useState } from "react";
import { CatalogEmpty } from "../components/catalog/CatalogState";
import { BestiaryHuntCreatures } from "../components/bestiary/BestiaryHuntCreatures";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/FormControls";
import { Toast } from "../components/ui/Toast";
import { companionSlugSet, formatBestiaryKills, formatEstimatedHours, recommendedEvolutionHunts } from "../domain/bestiary";
import { formatCharmLabel, formatCount } from "../domain/format";
import { huntSummary } from "../domain/hunts";
import { useAuth } from "../auth/AuthContext";
import { describeApiError } from "../services/api/errors";
import { updateBestiaryProgress } from "../services/api/bestiary";
import { useBestiaryCreature } from "./BestiaryCreaturePage";

export function BestiaryDetailPage() {
  const { entry, hunts, isAuthenticated, reload } = useBestiaryCreature();
  const { activeCharacter } = useAuth();
  const [kills, setKills] = useState(entry.progress ? String(entry.progress.kills) : "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  const route = recommendedEvolutionHunts(hunts, entry.slug, activeCharacter);
  const together = companionSlugSet(entry);

  useEffect(() => {
    setKills(entry.progress ? String(entry.progress.kills) : "");
  }, [entry]);

  async function handleProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await reload();
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
    <>
      <div className="bestiary-section-head">
        <div>
          <h2>Rota recomendada</h2>
          <p>
            Hunts cadastradas em que o {entry.name} aparece, em ordem de nível.
            {entry.killTogether.length
              ? ` Destaque para quem pode ser caçado junto: ${entry.killTogether.join(", ")}.`
              : ""}
          </p>
        </div>
      </div>

      {route.length === 0 ? (
        <CatalogEmpty
          description="Ainda não há hunts cadastradas com esta criatura."
          title="Nenhuma rota disponível"
        />
      ) : (
        <section className="bestiary-path" aria-label="Etapas da rota">
          {route.map((hunt, index) => {
            const summary = huntSummary(hunt);
            const isPrimary = hunt.spawn.some((creature) => creature.slug === entry.slug && creature.isPrimary);
            return (
              <article className="bestiary-step" key={hunt.id || hunt.slug}>
                <div className="bestiary-step__number">Etapa {index + 1}</div>
                <h3>{hunt.name}</h3>
                <p className="bestiary-step__trigger">
                  {[hunt.displayLocation, summary.level ? `Nível ${summary.level}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Local não informado"}
                </p>
                <BestiaryHuntCreatures
                  hunt={hunt}
                  selectedHours={entry.estimatedHours}
                  selectedSlug={entry.slug}
                  togetherSlugs={together}
                />
                <div className="bestiary-step__status">
                  {isPrimary ? (
                    <>O {entry.name} é a criatura principal desta hunt.</>
                  ) : (
                    <>O {entry.name} aparece nesta hunt junto com as criaturas listadas.</>
                  )}
                  {formatEstimatedHours(entry.estimatedHours)
                    ? ` Tempo de referência do bestiário: ${formatEstimatedHours(entry.estimatedHours)}.`
                    : ""}
                </div>
                <ButtonLink to={`/hunts/${hunt.slug}`}>Ir para a hunt</ButtonLink>
              </article>
            );
          })}
        </section>
      )}

      <section className="bestiary-logic">
        <h3>A lógica da rota</h3>
        <p>
          A rota usa as hunts reais em que esta criatura aparece. Quando existe hunt com o{" "}
          {entry.name} como criatura principal, essas entram primeiro; senão, entram todas as hunts
          cadastradas. A ordem segue o nível recomendado. Criaturas marcadas como “Junto” vêm da
          relação de caça em conjunto do bestiário.
        </p>
      </section>

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
            {formatEstimatedHours(entry.estimatedHours) ? (
              <div>
                <dt>Horas</dt>
                <dd>{formatEstimatedHours(entry.estimatedHours)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
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
    </>
  );
}
