import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { CatalogImage } from "../catalog/CatalogImage";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/FormControls";
import { Modal } from "../ui/Modal";
import {
  COMMUNITY_PLANNED_DURATIONS,
  COMMUNITY_RECOMMENDED_LEVEL_OPTIONS,
  COMMUNITY_TEXT_MAX,
  COMMUNITY_TITLE_MAX,
  type CommunityRecommendedLevel,
} from "../../domain/bosstiary-community";
import { huntModeLabel, type BosstiaryHuntMode } from "../../domain/bosstiary-rotations";
import { normalizeVocation, VOCATION_LABEL, VOCATIONS, type VocationCode } from "../../domain/vocation";
import { useLatestRequest } from "../../hooks/useLatestRequest";
import { describeApiError } from "../../services/api/errors";
import { listBosstiaryBosses, type BosstiaryReviewedBoss } from "../../services/api/bosstiary";
import { readPage } from "../../services/api/page";
import {
  createCommunityRotation,
  type CommunityRotationBossInput,
  type CreateCommunityRotationPayload,
} from "../../services/api/community-rotations";

type DraftBoss = {
  key: string;
  bossId?: string;
  bossName: string;
  slug?: string;
  imageUrl?: string | null;
  notes: string;
};

type CommunityRotationPublishModalProps = {
  onClose: () => void;
  onPublished: (id: string) => void;
  open: boolean;
};

const HUNT_MODES: BosstiaryHuntMode[] = ["SOLO", "PARTY"];
const BOSS_SEARCH_DEBOUNCE_MS = 300;

function newBossKey() {
  return `boss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CommunityRotationPublishModal({
  onClose,
  onPublished,
  open,
}: CommunityRotationPublishModalProps) {
  const { activeCharacter } = useAuth();
  const requests = useLatestRequest();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessRequirements, setAccessRequirements] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [recommendedLevel, setRecommendedLevel] = useState<CommunityRecommendedLevel>("L300");
  const [huntMode, setHuntMode] = useState<BosstiaryHuntMode>("SOLO");
  const [plannedDuration, setPlannedDuration] = useState<(typeof COMMUNITY_PLANNED_DURATIONS)[number]>(30);
  const [vocation, setVocation] = useState<VocationCode>(
    () => normalizeVocation(activeCharacter?.vocation) ?? "EK",
  );
  const [characterLevel, setCharacterLevel] = useState(() => String(activeCharacter?.level ?? ""));
  const [partySize, setPartySize] = useState("");
  const [observedTotal, setObservedTotal] = useState("");
  const [combatMinutes, setCombatMinutes] = useState("");
  const [travelMinutes, setTravelMinutes] = useState("");
  const [bosses, setBosses] = useState<DraftBoss[]>([]);
  const [bossSearch, setBossSearch] = useState("");
  const [bossQuery, setBossQuery] = useState("");
  const [bossHits, setBossHits] = useState<BosstiaryReviewedBoss[]>([]);
  const [bossLoading, setBossLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const publishIdempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setBossQuery(bossSearch.trim()), BOSS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [bossSearch]);

  const loadBosses = useCallback(async () => {
    const current = requests.start();
    setBossLoading(true);
    try {
      const result = readPage<BosstiaryReviewedBoss>(
        await listBosstiaryBosses({
          search: bossQuery || undefined,
          limit: 12,
        }),
      );
      if (!current()) return;
      setBossHits(result.items);
    } catch {
      if (current()) setBossHits([]);
    } finally {
      if (current()) setBossLoading(false);
    }
  }, [bossQuery, requests]);

  useEffect(() => {
    if (!open) return;
    void loadBosses();
  }, [loadBosses, open]);

  function reset() {
    setTitle("");
    setDescription("");
    setAccessRequirements("");
    setAdditionalInfo("");
    setRecommendedLevel("L300");
    setHuntMode("SOLO");
    setPlannedDuration(30);
    setVocation(normalizeVocation(activeCharacter?.vocation) ?? "EK");
    setCharacterLevel(String(activeCharacter?.level ?? ""));
    setPartySize("");
    setObservedTotal("");
    setCombatMinutes("");
    setTravelMinutes("");
    setBosses([]);
    setBossSearch("");
    setError("");
    publishIdempotencyKey.current = null;
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addBoss(hit: BosstiaryReviewedBoss) {
    setBosses((current) => [
      ...current,
      {
        key: newBossKey(),
        bossId: hit.id,
        bossName: hit.name,
        slug: hit.slug,
        imageUrl: null,
        notes: "",
      },
    ]);
    setBossSearch("");
  }

  function addCustomBoss() {
    const name = bossSearch.trim();
    if (name.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres para adicionar um boss customizado.");
      return;
    }
    setBosses((current) => [
      ...current,
      { key: newBossKey(), bossName: name, notes: "" },
    ]);
    setBossSearch("");
    setError("");
  }

  function moveBoss(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= bosses.length) return;
    setBosses((current) => {
      const copy = [...current];
      const removed = copy.splice(index, 1);
      const item = removed[0];
      if (!item) return copy;
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function removeBoss(key: string) {
    setBosses((current) => current.filter((item) => item.key !== key));
  }

  function optionalInt(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setError("O título precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (bosses.length === 0) {
      setError("Adicione pelo menos um boss à rotação.");
      return;
    }
    const bossPayload: CommunityRotationBossInput[] = bosses.map((stop, index) => ({
      position: index + 1,
      ...(stop.bossId ? { bossId: stop.bossId } : { bossName: stop.bossName }),
      ...(stop.notes.trim() ? { notes: stop.notes.trim() } : {}),
    }));

    const payload: CreateCommunityRotationPayload = {
      title: trimmedTitle,
      recommendedLevel,
      huntMode,
      plannedDurationMinutes: plannedDuration,
      bosses: bossPayload,
    };
    const desc = description.trim();
    const access = accessRequirements.trim();
    const extra = additionalInfo.trim();
    if (desc) payload.description = desc;
    if (access) payload.accessRequirements = access;
    if (extra) payload.additionalInfo = extra;
    payload.vocation = vocation;
    const level = optionalInt(characterLevel);
    const party = optionalInt(partySize);
    const observed = optionalInt(observedTotal);
    const combat = optionalInt(combatMinutes);
    const travel = optionalInt(travelMinutes);
    if (level) payload.characterLevel = level;
    if (party) payload.partySize = party;
    if (observed) payload.observedTotalMinutes = observed;
    if (combat) payload.combatMinutes = combat;
    if (travel !== undefined) payload.travelMinutes = travel;

    if (!publishIdempotencyKey.current) {
      publishIdempotencyKey.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    setPending(true);
    setError("");
    try {
      const created = await createCommunityRotation(payload, {
        idempotencyKey: publishIdempotencyKey.current,
      });
      publishIdempotencyKey.current = null;
      onPublished(created.id);
      handleClose();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      description="Compartilhe sua rotação de bosses com a comunidade. Os dados são validados pelo servidor."
      footer={
        <div className="bosstiary-community-publish__footer">
          <Button disabled={pending} onClick={handleClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={pending} form="community-rotation-publish" loading={pending} type="submit">
            Publicar rotação
          </Button>
        </div>
      }
      onClose={handleClose}
      open={open}
      title="Publicar rotação da comunidade"
    >
      <form className="bosstiary-community-publish" id="community-rotation-publish" onSubmit={submit}>
        {error ? (
          <p className="bosstiary-community-publish__error" role="alert">
            {error}
          </p>
        ) : null}

        <Input
          label="Título"
          maxLength={COMMUNITY_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />

        <div className="bosstiary-community-publish__grid">
          <Select
            label="Level recomendado"
            onChange={(e) => setRecommendedLevel(e.target.value as CommunityRecommendedLevel)}
            options={COMMUNITY_RECOMMENDED_LEVEL_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            value={recommendedLevel}
          />
          <Select
            label="Modo"
            onChange={(e) => setHuntMode(e.target.value as BosstiaryHuntMode)}
            options={HUNT_MODES.map((mode) => ({ value: mode, label: huntModeLabel(mode) }))}
            value={huntMode}
          />
          <Select
            label="Duração planejada"
            onChange={(e) =>
              setPlannedDuration(Number(e.target.value) as (typeof COMMUNITY_PLANNED_DURATIONS)[number])
            }
            options={COMMUNITY_PLANNED_DURATIONS.map((minutes) => ({
              value: String(minutes),
              label: `${minutes} min`,
            }))}
            value={String(plannedDuration)}
          />
        </div>

        <Textarea
          label="Descrição"
          maxLength={COMMUNITY_TEXT_MAX}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          value={description}
        />

        <Textarea
          label="Requisitos de acesso"
          maxLength={COMMUNITY_TEXT_MAX}
          onChange={(e) => setAccessRequirements(e.target.value)}
          rows={2}
          value={accessRequirements}
        />

        <Textarea
          label="Informações adicionais"
          maxLength={COMMUNITY_TEXT_MAX}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          rows={2}
          value={additionalInfo}
        />

        <fieldset className="bosstiary-community-publish__stats">
          <legend>Dados da sua run (opcional)</legend>
          <div className="bosstiary-community-publish__grid">
            <Select
              label="Vocação"
              onChange={(e) => setVocation(e.target.value as VocationCode)}
              options={VOCATIONS.map((code) => ({ value: code, label: VOCATION_LABEL[code] }))}
              value={vocation}
            />
            <Input
              inputMode="numeric"
              label="Level do personagem"
              onChange={(e) => setCharacterLevel(e.target.value)}
              value={characterLevel}
            />
            <Input
              inputMode="numeric"
              label="Tamanho do grupo"
              onChange={(e) => setPartySize(e.target.value)}
              value={partySize}
            />
            <Input
              inputMode="numeric"
              label="Tempo total observado (min)"
              onChange={(e) => setObservedTotal(e.target.value)}
              value={observedTotal}
            />
            <Input
              inputMode="numeric"
              label="Combate (min)"
              onChange={(e) => setCombatMinutes(e.target.value)}
              value={combatMinutes}
            />
            <Input
              inputMode="numeric"
              label="Deslocamento (min)"
              onChange={(e) => setTravelMinutes(e.target.value)}
              value={travelMinutes}
            />
          </div>
        </fieldset>

        <section className="bosstiary-community-publish__bosses" aria-labelledby="community-boss-picker">
          <div className="bosstiary-community-publish__bosses-head">
            <h3 id="community-boss-picker">Ordem dos bosses</h3>
            <p>Busque no Bosstiário revisado ou adicione um nome manual.</p>
          </div>
          <div className="bosstiary-community-publish__boss-search">
            <Input
              label="Buscar boss"
              onChange={(e) => setBossSearch(e.target.value)}
              placeholder="Buscar boss..."
              value={bossSearch}
            />
            <Button disabled={bossSearch.trim().length < 2} onClick={addCustomBoss} type="button" variant="secondary">
              Adicionar nome
            </Button>
          </div>
          {bossLoading ? <p className="bosstiary-community-publish__hint">Buscando bosses…</p> : null}
          {bossHits.length ? (
            <ul className="bosstiary-community-publish__boss-hits">
              {bossHits.map((hit) => (
                <li key={hit.id}>
                  <button onClick={() => addBoss(hit)} type="button">
                    <CatalogImage alt="" name={hit.name} />
                    <span>{hit.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : bossQuery ? (
            <p className="bosstiary-community-publish__hint">Nenhum boss revisado encontrado para esta busca.</p>
          ) : null}

          {bosses.length === 0 ? (
            <p className="bosstiary-community-publish__empty">Nenhum boss na rotação ainda.</p>
          ) : (
            <ol className="bosstiary-community-publish__boss-list">
              {bosses.map((stop, index) => (
                <li key={stop.key}>
                  <span className="bosstiary-community-publish__boss-pos">{index + 1}</span>
                  <div className="bosstiary-community-publish__boss-main">
                    <strong>{stop.bossName}</strong>
                    <Input
                      label="Notas deste stop"
                      onChange={(e) =>
                        setBosses((current) =>
                          current.map((item) =>
                            item.key === stop.key ? { ...item, notes: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Opcional"
                      value={stop.notes}
                    />
                  </div>
                  <div className="bosstiary-community-publish__boss-actions">
                    <Button
                      aria-label="Mover para cima"
                      disabled={index === 0}
                      onClick={() => moveBoss(index, -1)}
                      type="button"
                      variant="ghost"
                    >
                      ↑
                    </Button>
                    <Button
                      aria-label="Mover para baixo"
                      disabled={index === bosses.length - 1}
                      onClick={() => moveBoss(index, 1)}
                      type="button"
                      variant="ghost"
                    >
                      ↓
                    </Button>
                    <Button onClick={() => removeBoss(stop.key)} type="button" variant="danger">
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </form>
    </Modal>
  );
}
