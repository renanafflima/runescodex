import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Input, SearchInput, Textarea } from "../components/ui/FormControls";
import {
  CHARM_GUIDE_CATEGORIES,
  CHARM_GUIDE_DIFFICULTY_LABEL,
  isCharmGuideUuid,
} from "../domain/charm-guides";
import { mapBestiaryEntry } from "../domain/bestiary";
import { mapHuntDetail, mapHuntListItem } from "../domain/hunts";
import { ApiError, describeApiError } from "../services/api/errors";
import { listBestiaryPage } from "../services/api/bestiary";
import {
  createCharmGuide,
  submitCharmGuide,
  updateCharmGuide,
  type CharmGuideCpCategory,
  type CharmGuideDifficulty,
  type CharmGuideStepInput,
} from "../services/api/charm-guides";
import { getHuntBySlug, listHuntsPage } from "../services/api/hunts";

type DraftCreature = {
  id: string;
  slug: string;
  name: string;
  image: string;
  difficulty: string | null;
  charmPoints: number | null;
};

type DraftStep = {
  key: string;
  huntId?: string;
  huntSlug?: string;
  huntName?: string;
  title: string;
  creatures: DraftCreature[];
};

const DIFFICULTIES: CharmGuideDifficulty[] = ["EASY", "MEDIUM", "ADVANCED", "CHALLENGING"];

function newStep(): DraftStep {
  return {
    key: crypto.randomUUID(),
    title: "",
    creatures: [],
  };
}

function logPublishError(scope: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[charm-guide-publish] ${scope}`, error);
  }
}

function formatPublishError(error: unknown) {
  if (error instanceof Error && !(error instanceof ApiError)) {
    return error.message;
  }
  return describeApiError(error);
}

export function CharmGuidePublishPage() {
  const navigate = useNavigate();
  const [wizardStep, setWizardStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cpCategory, setCpCategory] = useState<CharmGuideCpCategory>("CP_100");
  const [difficulty, setDifficulty] = useState<CharmGuideDifficulty>("EASY");
  const [coverImage, setCoverImage] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([newStep()]);
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const [draftGuideId, setDraftGuideId] = useState<string | null>(null);
  const [huntQuery, setHuntQuery] = useState("");
  const [creatureQuery, setCreatureQuery] = useState("");
  const [huntResults, setHuntResults] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [creatureResults, setCreatureResults] = useState<DraftCreature[]>([]);
  const [huntSearchBusy, setHuntSearchBusy] = useState(false);
  const [creatureSearchBusy, setCreatureSearchBusy] = useState(false);
  const [creatureSearchError, setCreatureSearchError] = useState("");
  const [huntSearchError, setHuntSearchError] = useState("");
  const huntSearchSeq = useRef(0);
  const creatureSearchSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeStep = steps.find((step) => step.key === activeStepKey) ?? steps[0];

  const totals = useMemo(() => {
    const seen = new Set<string>();
    let uniqueCp = 0;
    let occurrences = 0;
    for (const step of steps) {
      for (const creature of step.creatures) {
        occurrences += 1;
        if (seen.has(creature.id)) continue;
        seen.add(creature.id);
        uniqueCp += creature.charmPoints ?? 0;
      }
    }
    return {
      hunts: steps.filter((step) => step.huntId).length,
      uniqueCreatures: seen.size,
      occurrences,
      uniqueCp,
    };
  }, [steps]);

  useEffect(() => {
    if (!activeStep) setActiveStepKey(steps[0]?.key ?? null);
  }, [activeStep, steps]);

  useEffect(() => {
    const query = huntQuery.trim();
    if (query.length < 2) {
      setHuntResults([]);
      setHuntSearchBusy(false);
      setHuntSearchError("");
      return;
    }
    const timer = window.setTimeout(() => {
      const requestId = ++huntSearchSeq.current;
      setHuntSearchBusy(true);
      setHuntSearchError("");
      void listHuntsPage({ search: query, limit: 8 })
        .then((page) => {
          if (requestId !== huntSearchSeq.current) return;
          setHuntResults(
            page.items
              .map((item) => mapHuntListItem(item))
              .map((hunt) => ({ id: hunt.id, slug: hunt.slug, name: hunt.name })),
          );
        })
        .catch((err) => {
          if (requestId !== huntSearchSeq.current) return;
          logPublishError("hunt-search", err);
          setHuntResults([]);
          setHuntSearchError("Não foi possível buscar hunts agora.");
        })
        .finally(() => {
          if (requestId === huntSearchSeq.current) {
            setHuntSearchBusy(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [huntQuery]);

  useEffect(() => {
    const query = creatureQuery.trim();
    if (query.length < 2) {
      setCreatureResults([]);
      setCreatureSearchBusy(false);
      setCreatureSearchError("");
      return;
    }
    const timer = window.setTimeout(() => {
      const requestId = ++creatureSearchSeq.current;
      setCreatureSearchBusy(true);
      setCreatureSearchError("");
      void listBestiaryPage({ search: query, limit: 8 })
        .then((page) => {
          if (requestId !== creatureSearchSeq.current) return;
          setCreatureResults(
            page.items
              .map((item) => mapBestiaryEntry(item))
              .filter((entry) => isCharmGuideUuid(entry.id))
              .map((entry) => ({
                id: entry.id,
                slug: entry.slug,
                name: entry.name,
                image: entry.image || "",
                difficulty: entry.difficulty,
                charmPoints: entry.charmPoints,
              })),
          );
        })
        .catch((err) => {
          if (requestId !== creatureSearchSeq.current) return;
          logPublishError("creature-search", err);
          setCreatureResults([]);
          setCreatureSearchError("Não foi possível buscar criaturas agora.");
        })
        .finally(() => {
          if (requestId === creatureSearchSeq.current) {
            setCreatureSearchBusy(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [creatureQuery]);

  function updateStep(key: string, patch: Partial<DraftStep>) {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  }

  function moveStep(key: string, direction: -1 | 1) {
    setSteps((current) => {
      const index = current.findIndex((step) => step.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      if (!row) return current;
      copy.splice(target, 0, row);
      return copy;
    });
  }

  async function attachHunt(hunt: { id: string; slug: string; name: string }) {
    if (!activeStep) return;
    if (steps.some((step) => step.key !== activeStep.key && step.huntId === hunt.id)) {
      setError("Esta Hunt já está em outra etapa do guia.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const detail = mapHuntDetail(await getHuntBySlug(hunt.slug));
      const creatures = detail.spawn
        .filter((creature) => creature.id && isCharmGuideUuid(creature.id))
        .map((creature) => ({
          id: creature.id as string,
          slug: creature.slug || "",
          name: creature.name,
          image: creature.image || "",
          difficulty: creature.catalogDifficulty,
          charmPoints: creature.bestiary.charmPoints,
        }));
      updateStep(activeStep.key, {
        huntId: hunt.id,
        huntSlug: hunt.slug,
        huntName: hunt.name,
        title: hunt.name,
        creatures,
      });
      setHuntQuery("");
      setHuntResults([]);
    } catch (err) {
      logPublishError("attach-hunt", err);
      setError(formatPublishError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleCreature(creature: DraftCreature) {
    if (!activeStep) return;
    const exists = activeStep.creatures.some((item) => item.id === creature.id);
    updateStep(activeStep.key, {
      creatures: exists
        ? activeStep.creatures.filter((item) => item.id !== creature.id)
        : [...activeStep.creatures, creature],
    });
  }

  function toPayload(): CharmGuideStepInput[] {
    return steps.map((step) => ({
      huntId: step.huntId && isCharmGuideUuid(step.huntId) ? step.huntId : undefined,
      title: step.title || step.huntName || undefined,
      creatureIds: step.creatures
        .map((creature) => creature.id)
        .filter((id) => isCharmGuideUuid(id)),
    }));
  }

  function validateGuidePayload() {
    if (title.trim().length < 3) throw new Error("Informe um título com pelo menos 3 caracteres.");
    if (description.trim().length < 10) {
      throw new Error("Informe uma descrição com pelo menos 10 caracteres.");
    }
    if (steps.some((step) => step.creatures.length === 0)) {
      throw new Error("Cada etapa precisa de ao menos uma criatura.");
    }
    const payload = toPayload();
    if (payload.some((step) => step.creatureIds.length === 0)) {
      throw new Error(
        "Uma ou mais criaturas são inválidas. Pesquise novamente no Bestiário antes de continuar.",
      );
    }
    return payload;
  }

  function buildCreateBody(stepsPayload: CharmGuideStepInput[]) {
    return {
      title: title.trim(),
      description: description.trim(),
      cpCategory,
      difficulty,
      coverImage: coverImage.trim() || undefined,
      steps: stepsPayload,
    };
  }

  async function persistDraft(): Promise<string> {
    const stepsPayload = validateGuidePayload();
    const body = buildCreateBody(stepsPayload);
    if (draftGuideId && isCharmGuideUuid(draftGuideId)) {
      const updated = await updateCharmGuide(draftGuideId, body);
      if (!isCharmGuideUuid(updated.id)) {
        throw new Error("Resposta inválida da API ao atualizar o guia.");
      }
      return updated.id;
    }
    const created = await createCharmGuide(body);
    if (!isCharmGuideUuid(created.id)) {
      throw new Error("Resposta inválida da API ao criar o guia.");
    }
    setDraftGuideId(created.id);
    return created.id;
  }

  async function goToReview() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await persistDraft();
      setWizardStep(2);
    } catch (err) {
      logPublishError("persist-review", err);
      setError(formatPublishError(err));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const guideId = await persistDraft();
      const submitted = await submitCharmGuide(guideId, `publish:${guideId}`);
      if (!isCharmGuideUuid(submitted.id)) {
        throw new Error("Resposta inválida da API ao enviar o guia.");
      }
      setNotice("Guia enviado para análise da equipe.");
      navigate(`/bestiary/guides/${submitted.id}`);
    } catch (err) {
      logPublishError("submit", err);
      setError(formatPublishError(err));
    } finally {
      setBusy(false);
    }
  }

  function changeWizardStep(index: number) {
    if (index === wizardStep) return;
    if (index === 2 && wizardStep < 2) {
      void goToReview();
      return;
    }
    setWizardStep(index);
  }

  return (
    <div className="charm-guide-publish">
      <PageContainer size="wide">
        <p>
          <Link to="/bestiary">← Voltar ao Bestiário</Link>
        </p>
        <header className="section-head">
          <div>
            <div className="section-kicker">Publicação</div>
            <h1>Publicar guia de Charm Points</h1>
            <p>Monte etapas com Hunts e criaturas reais do catálogo. Os CP vêm do Bestiário.</p>
          </div>
        </header>

        <nav className="wizard-steps" aria-label="Etapas do formulário">
          {["Dados do guia", "Etapas e criaturas", "Revisão"].map((label, index) => (
            <button
              className={wizardStep === index ? "is-active" : ""}
              key={label}
              onClick={() => changeWizardStep(index)}
              type="button"
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>

        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}

        {wizardStep === 0 ? (
          <section className="wizard-panel">
            <Input label="Título" onChange={(event) => setTitle(event.target.value)} value={title} />
            <Textarea
              label="Descrição"
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              value={description}
            />
            <Input
              hint="Opcional. URL pública da capa."
              label="Imagem de capa"
              onChange={(event) => setCoverImage(event.target.value)}
              value={coverImage}
            />
            <div>
              <p className="field__label">Categoria de Charm Points</p>
              <div className="chip-row">
                {CHARM_GUIDE_CATEGORIES.map((category) => (
                  <Chip
                    active={cpCategory === category.cpCategory}
                    key={category.cpCategory}
                    onClick={() => setCpCategory(category.cpCategory)}
                  >
                    {category.targetPoints} CP · {category.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="field__label">Classificação do guia</p>
              <div className="chip-row">
                {DIFFICULTIES.map((item) => (
                  <Chip active={difficulty === item} key={item} onClick={() => setDifficulty(item)}>
                    {CHARM_GUIDE_DIFFICULTY_LABEL[item]}
                  </Chip>
                ))}
              </div>
            </div>
            <Button onClick={() => setWizardStep(1)} type="button">
              Continuar
            </Button>
          </section>
        ) : null}

        {wizardStep === 1 ? (
          <section className="wizard-panel wizard-panel--steps">
            <div className="step-list">
              {steps.map((step, index) => (
                <article
                  className={`draft-step${activeStep?.key === step.key ? " is-active" : ""}`}
                  key={step.key}
                >
                  <header>
                    <button onClick={() => setActiveStepKey(step.key)} type="button">
                      Etapa {index + 1}
                      {step.huntName ? ` — ${step.huntName}` : step.title ? ` — ${step.title}` : ""}
                    </button>
                    <div className="draft-step__tools">
                      <Button onClick={() => moveStep(step.key, -1)} type="button" variant="ghost">
                        ↑
                      </Button>
                      <Button onClick={() => moveStep(step.key, 1)} type="button" variant="ghost">
                        ↓
                      </Button>
                      <Button
                        onClick={() =>
                          setSteps((current) =>
                            current.length === 1 ? current : current.filter((row) => row.key !== step.key),
                          )
                        }
                        type="button"
                        variant="ghost"
                      >
                        Remover
                      </Button>
                    </div>
                  </header>
                  <p>
                    {step.creatures.length} criaturas
                    {step.huntId ? " · Hunt vinculada" : " · sem Hunt"}
                  </p>
                </article>
              ))}
              <Button
                onClick={() => {
                  const step = newStep();
                  setSteps((current) => [...current, step]);
                  setActiveStepKey(step.key);
                }}
                type="button"
                variant="secondary"
              >
                ＋ Adicionar etapa
              </Button>
            </div>

            {activeStep ? (
              <div className="step-editor">
                <Input
                  label="Título da etapa"
                  onChange={(event) => updateStep(activeStep.key, { title: event.target.value })}
                  value={activeStep.title}
                />
                <div>
                  <p className="field__label">Buscar Hunt do catálogo</p>
                  <SearchInput
                    loading={huntSearchBusy}
                    onChange={(event) => setHuntQuery(event.target.value)}
                    placeholder="Nome da Hunt"
                    value={huntQuery}
                  />
                  {huntSearchError ? (
                    <p className="field__message" role="status">
                      {huntSearchError}
                    </p>
                  ) : null}
                  <ul className="picker-list">
                    {huntResults.map((hunt) => (
                      <li key={hunt.id}>
                        <button disabled={busy} onClick={() => void attachHunt(hunt)} type="button">
                          {hunt.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {activeStep.huntId ? (
                    <Button
                      onClick={() =>
                        updateStep(activeStep.key, {
                          huntId: undefined,
                          huntSlug: undefined,
                          huntName: undefined,
                        })
                      }
                      type="button"
                      variant="ghost"
                    >
                      Remover Hunt (manter criaturas)
                    </Button>
                  ) : null}
                </div>

                <div>
                  <p className="field__label">Buscar criatura do Bestiário</p>
                  <SearchInput
                    loading={creatureSearchBusy}
                    onChange={(event) => setCreatureQuery(event.target.value)}
                    placeholder="Nome da criatura"
                    value={creatureQuery}
                  />
                  {creatureSearchBusy && creatureResults.length === 0 ? (
                    <p className="field__message" role="status">
                      Buscando criaturas…
                    </p>
                  ) : null}
                  {creatureSearchError ? (
                    <p className="field__message field__message--error" role="status">
                      {creatureSearchError}
                    </p>
                  ) : null}
                  {!creatureSearchBusy &&
                  creatureQuery.trim().length >= 2 &&
                  creatureResults.length === 0 &&
                  !creatureSearchError ? (
                    <p className="field__message" role="status">
                      Nenhuma criatura encontrada.
                    </p>
                  ) : null}
                  <ul className="picker-list picker-list--creatures">
                    {creatureResults.map((creature) => {
                      const selected = activeStep.creatures.some((item) => item.id === creature.id);
                      return (
                        <li key={creature.id}>
                          <button onClick={() => toggleCreature(creature)} type="button">
                            <CatalogImage alt="" name={creature.name} src={creature.image} />
                            <span>
                              <strong>{creature.name}</strong>
                              <small>
                                {creature.difficulty || "—"} ·{" "}
                                {creature.charmPoints != null ? `${creature.charmPoints} CP` : "CP n/d"}
                              </small>
                            </span>
                            <em>{selected ? "Remover" : "Adicionar"}</em>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <ul className="selected-creatures">
                  {activeStep.creatures.map((creature) => (
                    <li key={creature.id}>
                      <CatalogImage alt="" name={creature.name} src={creature.image} />
                      <span>
                        {creature.name} ·{" "}
                        {creature.charmPoints != null ? `${creature.charmPoints} CP` : "CP n/d"}
                      </span>
                      <Button onClick={() => toggleCreature(creature)} type="button" variant="ghost">
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="wizard-actions">
              <Button onClick={() => setWizardStep(0)} type="button" variant="secondary">
                Voltar
              </Button>
              <Button loading={busy} onClick={() => void goToReview()} type="button">
                Revisar
              </Button>
            </div>
          </section>
        ) : null}

        {wizardStep === 2 ? (
          <section className="wizard-panel">
            <h2>{title || "Sem título"}</h2>
            <p>{description}</p>
            <div className="post-tags">
              <span>
                {CHARM_GUIDE_CATEGORIES.find((item) => item.cpCategory === cpCategory)?.targetPoints} CP
              </span>
              <span>{CHARM_GUIDE_DIFFICULTY_LABEL[difficulty]}</span>
              <span>{totals.hunts} Hunts</span>
              <span>{totals.uniqueCreatures} criaturas únicas</span>
              <span>{totals.occurrences} ocorrências</span>
              <span>{totals.uniqueCp} CP sem duplicidade</span>
            </div>
            <ol className="charm-guide-steps">
              {steps.map((step, index) => (
                <li className="charm-guide-step" key={step.key}>
                  <h3>
                    Etapa {index + 1}
                    {step.huntName || step.title ? ` — ${step.huntName || step.title}` : ""}
                  </h3>
                  <ul>
                    {step.creatures.map((creature) => (
                      <li key={creature.id}>
                        {creature.name} ·{" "}
                        {creature.charmPoints != null ? `${creature.charmPoints} CP` : "CP n/d"}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            <div className="wizard-actions">
              <Button onClick={() => setWizardStep(1)} type="button" variant="secondary">
                Voltar
              </Button>
              <Button disabled={busy} loading={busy} onClick={() => void publish()} type="button">
                Enviar para análise
              </Button>
            </div>
          </section>
        ) : null}
      </PageContainer>
    </div>
  );
}
