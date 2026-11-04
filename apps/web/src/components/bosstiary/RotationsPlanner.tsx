import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CatalogEmpty, CatalogError } from "../catalog/CatalogState";
import { CharacterSwitcher } from "../characters/CharacterSwitcher";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/FormControls";
import { formatMinutes } from "../../domain/bosstiary";
import {
  BOSSTIARY_ORIGIN_CITIES,
  BOSSTIARY_TIME_OPTIONS,
  huntModeLabel,
  type BosstiaryHuntMode,
  type BosstiaryRotation,
  type BosstiaryTimeMinutes,
} from "../../domain/bosstiary-rotations";
import { normalizeVocation, VOCATION_LABEL, VOCATIONS, type VocationCode } from "../../domain/vocation";
import { useLatestRequest } from "../../hooks/useLatestRequest";
import { describeApiError } from "../../services/api/errors";
import { findBosstiaryRotations } from "../../services/api/bosstiary";

const HUNT_MODES: BosstiaryHuntMode[] = ["SOLO", "PARTY"];

export function RotationsPlanner() {
  const { activeCharacter } = useAuth();
  const request = useLatestRequest();
  const [minutes, setMinutes] = useState<BosstiaryTimeMinutes>(30);
  const [level, setLevel] = useState(() => String(activeCharacter?.level ?? 300));
  const [huntMode, setHuntMode] = useState<BosstiaryHuntMode>("SOLO");
  const [vocation, setVocation] = useState<VocationCode>(() =>
    normalizeVocation(activeCharacter?.vocation) ?? "EK",
  );
  const [originCity, setOriginCity] = useState<string>(BOSSTIARY_ORIGIN_CITIES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<BosstiaryRotation[]>([]);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [dataGaps, setDataGaps] = useState<string[]>([]);

  useEffect(() => {
    if (!activeCharacter) return;
    setLevel(String(activeCharacter.level));
    const nextVocation = normalizeVocation(activeCharacter.vocation);
    if (nextVocation) setVocation(nextVocation);
  }, [activeCharacter]);

  async function onFindRotations() {
    const parsedLevel = Number.parseInt(level, 10);
    if (!Number.isFinite(parsedLevel) || parsedLevel < 1) {
      setError("Informe um level válido para montar a rotação.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    const isLatest = request.start();

    try {
      const response = await findBosstiaryRotations({
        availableMinutes: minutes,
        level: parsedLevel,
        huntMode,
        vocation,
        originCity,
      });
      if (!isLatest()) return;
      setItems(response.items ?? []);
      setEmptyReason(response.emptyReason ?? null);
      setDataGaps(response.dataGaps ?? []);
    } catch (err) {
      if (!isLatest()) return;
      setItems([]);
      setEmptyReason(null);
      setDataGaps([]);
      setError(describeApiError(err));
    } finally {
      if (isLatest()) setLoading(false);
    }
  }

  return (
    <section className="bosstiary-rotations" aria-labelledby="rotations-title">
      <div className="bosstiary-section-title">
        <h2 id="rotations-title">Monte sua rotação</h2>
        <p>
          Quanto tempo você tem hoje? Nós encontramos uma sequência de bosses para aproveitar esse
          período.
        </p>
      </div>

      <div className="bosstiary-time-row" role="list" aria-label="Tempo disponível hoje">
        {BOSSTIARY_TIME_OPTIONS.map((option) => {
          const active = minutes === option.minutes;
          return (
            <button
              aria-pressed={active}
              className={`bosstiary-time-card${active ? " bosstiary-time-card--active" : ""}`}
              key={option.minutes}
              onClick={() => setMinutes(option.minutes)}
              type="button"
            >
              <strong>{option.title}</strong>
              <span>{option.subtitle}</span>
            </button>
          );
        })}
      </div>

      <div className="bosstiary-filters">
        <div className="bosstiary-filters__fields">
          <CharacterSwitcher className="bosstiary-filters__character" id="bosstiary-character" />
          <Input
            inputMode="numeric"
            label="Seu level"
            min={1}
            onChange={(event) => setLevel(event.target.value)}
            type="number"
            value={level}
          />
          <Select
            label="Modo de caça"
            onChange={(event) => setHuntMode(event.target.value as BosstiaryHuntMode)}
            options={HUNT_MODES.map((mode) => ({ value: mode, label: huntModeLabel(mode) }))}
            value={huntMode}
          />
          <Select
            label="Vocação"
            onChange={(event) => setVocation(event.target.value as VocationCode)}
            options={VOCATIONS.map((code) => ({ value: code, label: VOCATION_LABEL[code] }))}
            value={vocation}
          />
          <Select
            label="Onde você está?"
            onChange={(event) => setOriginCity(event.target.value)}
            options={BOSSTIARY_ORIGIN_CITIES.map((city) => ({ value: city, label: city }))}
            value={originCity}
          />
        </div>
        <Button
          className="bosstiary-gold-button"
          loading={loading}
          onClick={() => void onFindRotations()}
          size="lg"
          type="button"
          variant="primary"
        >
          Encontrar rotações
        </Button>
      </div>

      {error ? <CatalogError description={error} onRetry={() => void onFindRotations()} /> : null}

      {searched && !loading && !error ? (
        <div className="bosstiary-rotation-results">
          {items.length === 0 ? (
            <CatalogEmpty
              description={
                emptyReason ??
                "Ainda não há rotações verificadas para essa combinação de tempo, level, modo, vocação e cidade. Conforme perfis e deslocamentos forem revisados, novas sequências aparecerão aqui."
              }
              title="Nenhuma rotação verificada"
            />
          ) : (
            items.map((rotation) => <RotationCard key={rotation.id} rotation={rotation} />)
          )}
          {dataGaps.length > 0 ? (
            <p className="bosstiary-data-gaps">
              Dados ainda incompletos: {dataGaps.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RotationCard({ rotation }: { rotation: BosstiaryRotation }) {
  return (
    <article className="bosstiary-rotation-card">
      <header className="bosstiary-rotation-card__head">
        <div>
          <h3>{rotation.name}</h3>
          {rotation.pointsPerMinute != null ? (
            <p className="bosstiary-rotation-card__efficiency">
              Eficiência verificada: {rotation.pointsPerMinute.toFixed(2)} BP/min
            </p>
          ) : null}
        </div>
        <dl className="bosstiary-rotation-card__stats">
          <div>
            <dt>Tempo total</dt>
            <dd>{formatMinutes(rotation.totalMinutes) ?? "—"}</dd>
          </div>
          <div>
            <dt>Deslocamento</dt>
            <dd>{formatMinutes(rotation.totalTravelMinutes) ?? "—"}</dd>
          </div>
          <div>
            <dt>Bosses</dt>
            <dd>{rotation.bossCount}</dd>
          </div>
        </dl>
      </header>

      <ol className="bosstiary-rotation-card__stops">
        {rotation.stops.map((stop) => (
          <li key={`${rotation.id}-${stop.position}-${stop.slug}`}>
            <span className="bosstiary-rotation-card__stop-name">{stop.name}</span>
            <span className="bosstiary-rotation-card__stop-meta">
              Combate {formatMinutes(stop.combatMinutes) ?? "—"}
              {stop.travelKnown ? ` · Deslocamento ${formatMinutes(stop.travelMinutes) ?? "—"}` : ""}
            </span>
          </li>
        ))}
      </ol>

      {rotation.stops[0] ? (
        <Link className="bosstiary-rotation-card__details" to={`/bosstiary/${rotation.stops[0].slug}`}>
          Ver detalhes
        </Link>
      ) : null}
    </article>
  );
}
