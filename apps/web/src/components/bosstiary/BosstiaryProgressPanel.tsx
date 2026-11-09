import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PartyPanel } from "./PartyPanel";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { CatalogImage } from "../catalog/CatalogImage";
import { Button } from "../ui/Button";
import { Input, Select, Textarea } from "../ui/FormControls";
import { Pagination } from "../ui/Pagination";
import { useLatestRequest } from "../../hooks/useLatestRequest";
import { describeApiError } from "../../services/api/errors";
import { listBosstiaryBosses, type BosstiaryReviewedBoss } from "../../services/api/bosstiary";
import { readPage } from "../../services/api/page";
import {
  createBosstiaryProgressActivity,
  deleteBosstiaryProgressActivity,
  getBosstiaryProgressSummary,
  listBosstiaryProgressActivities,
  listBosstiaryProgressChecklist,
  listBosstiaryProgressRotations,
  updateBosstiaryProgressActivity,
  updateBosstiaryProgressChecklist,
  type BosstiaryActivityKind,
  type BosstiaryChecklistItem,
  type BosstiaryProgressActivity,
  type BosstiaryProgressRotationOption,
  type BosstiaryProgressSummary,
  type BosstiaryVisibility,
} from "../../services/api/bosstiary-progress";
import { listHuntSessions, listMyParties, type HuntSession, type PartySummary } from "../../services/api/parties";

const SEARCH_DEBOUNCE_MS = 300;
type ProgressView = "mine" | "all" | "party";

const EMPTY_SUMMARY: BosstiaryProgressSummary = {
  bossesDefeated: 0,
  dropsRegistered: 0,
  activitiesRegistered: 0,
  bossesTracked: 0,
  bossesCataloged: 0,
};

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function visibilityLabel(value: BosstiaryVisibility) {
  if (value === "PUBLIC") return "Público";
  if (value === "GROUP") return "Grupo (party/sessão)";
  return "Privado";
}

function activityTitle(row: BosstiaryProgressActivity) {
  if (row.kind === "DROP") return row.itemName ?? "Drop";
  return row.bossName;
}

function activityMeta(row: BosstiaryProgressActivity) {
  const when = new Date(row.occurredAt).toLocaleString("pt-BR");
  if (row.kind === "DROP") {
    return `Drop obtido em ${row.bossName} · ${when}${row.itemQuantity ? ` · x${row.itemQuantity}` : ""}`;
  }
  return `Boss derrotado · ${when}${row.rotationTitle ? ` · ${row.rotationTitle}` : ""} · ${visibilityLabel(row.visibility)}`;
}

export function BosstiaryProgressPanel() {
  const requests = useLatestRequest();
  const [view, setView] = useState<ProgressView>("mine");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [activities, setActivities] = useState<BosstiaryProgressActivity[]>([]);
  const [rotations, setRotations] = useState<BosstiaryProgressRotationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<BosstiaryActivityKind>("BOSS_KILL");
  const [occurredAt, setOccurredAt] = useState(todayInput);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<BosstiaryVisibility>("PRIVATE");
  const [rotationId, setRotationId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [bossSearch, setBossSearch] = useState("");
  const [bossQuery, setBossQuery] = useState("");
  const [bossHits, setBossHits] = useState<BosstiaryReviewedBoss[]>([]);
  const [selectedBoss, setSelectedBoss] = useState<BosstiaryReviewedBoss | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [checklist, setChecklist] = useState<BosstiaryChecklistItem[]>([]);
  const [checkSearch, setCheckSearch] = useState("");
  const [checkQuery, setCheckQuery] = useState("");
  const [checkFilter, setCheckFilter] = useState<"ALL" | "DONE" | "PENDING">("ALL");
  const [checkPage, setCheckPage] = useState(1);
  const [checkTotal, setCheckTotal] = useState(0);
  const [editingId, setEditingId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<BosstiaryVisibility>("PRIVATE");
  const [dropSearch, setDropSearch] = useState("");
  const [dropFrom, setDropFrom] = useState("");
  const [dropTo, setDropTo] = useState("");
  const [partyId, setPartyId] = useState("");
  const [huntSessionId, setHuntSessionId] = useState("");
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [sessions, setSessions] = useState<HuntSession[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBossQuery(bossSearch.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [bossSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCheckPage(1);
      setCheckQuery(checkSearch.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [checkSearch]);

  useEffect(() => {
    if (!bossQuery) {
      setBossHits([]);
      return;
    }
    const current = requests.start();
    void listBosstiaryBosses({ search: bossQuery, limit: 8 })
      .then((body) => {
        if (!current()) return;
        setBossHits(readPage<BosstiaryReviewedBoss>(body).items);
      })
      .catch(() => {
        if (!current()) return;
        setBossHits([]);
      });
  }, [bossQuery, requests]);

  const loadMine = useCallback(async () => {
    const current = requests.start();
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextActivities, nextRotations, nextParties] = await Promise.all([
        getBosstiaryProgressSummary(),
        listBosstiaryProgressActivities({ limit: 20 }),
        listBosstiaryProgressRotations(),
        listMyParties(),
      ]);
      if (!current()) return;
      setSummary(nextSummary);
      setActivities(nextActivities.items);
      setRotations(nextRotations);
      setParties(nextParties.items);
    } catch (err) {
      if (!current()) return;
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [requests]);

  const loadChecklist = useCallback(async () => {
    const current = requests.start();
    setLoading(true);
    setError("");
    try {
      const result = await listBosstiaryProgressChecklist({
        search: checkQuery || undefined,
        filter: checkFilter,
        page: checkPage,
        limit: 20,
      });
      if (!current()) return;
      setChecklist(result.items);
      setCheckTotal(result.total);
    } catch (err) {
      if (!current()) return;
      setError(describeApiError(err));
    } finally {
      if (current()) setLoading(false);
    }
  }, [checkFilter, checkPage, checkQuery, requests]);

  useEffect(() => {
    if (view === "mine") void loadMine();
    else if (view === "all") void loadChecklist();
  }, [view, loadMine, loadChecklist]);

  useEffect(() => {
    if (!partyId) {
      setSessions([]);
      setHuntSessionId("");
      return;
    }
    void listHuntSessions(partyId).then((result) => setSessions(result.items)).catch(() => setSessions([]));
  }, [partyId]);

  const drops = useMemo(() => {
    return activities.filter((row) => {
      if (row.kind !== "DROP") return false;
      if (dropSearch && !`${row.itemName ?? ""} ${row.bossName}`.toLowerCase().includes(dropSearch.toLowerCase())) {
        return false;
      }
      const when = row.occurredAt.slice(0, 10);
      if (dropFrom && when < dropFrom) return false;
      if (dropTo && when > dropTo) return false;
      return true;
    });
  }, [activities, dropFrom, dropSearch, dropTo]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setPending(true);
    try {
      await createBosstiaryProgressActivity({
        kind,
        bossId: selectedBoss?.id,
        bossName: selectedBoss ? undefined : bossSearch.trim() || undefined,
        rotationId: rotationId || undefined,
        partyId: partyId || undefined,
        huntSessionId: huntSessionId || undefined,
        itemName: kind === "DROP" ? itemName.trim() : undefined,
        itemQuantity: kind === "DROP" ? Number(itemQuantity) : undefined,
        note: note.trim() || undefined,
        visibility,
        occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
      });
      setNote("");
      setItemName("");
      await loadMine();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Excluir este registro do seu histórico?")) return;
    await deleteBosstiaryProgressActivity(id);
    await loadMine();
  }

  function startEdit(row: BosstiaryProgressActivity) {
    setEditingId(row.id);
    setEditNote(row.note ?? "");
    setEditVisibility(row.visibility);
  }

  async function saveEdit(id: string) {
    await updateBosstiaryProgressActivity(id, {
      note: editNote.trim() || null,
      visibility: editVisibility,
    });
    setEditingId("");
    await loadMine();
  }

  async function toggleChecklist(item: BosstiaryChecklistItem) {
    await updateBosstiaryProgressChecklist(item.bossId, !item.defeated);
    await loadChecklist();
  }

  return (
    <section className="bosstiary-progress">
      <header className="bosstiary-section-title">
        <div>
          <h2>Meu Progresso</h2>
          <p>Registre suas caçadas, acompanhe os bosses derrotados e mantenha seu histórico de drops em um só lugar.</p>
        </div>
        <span className="subtle">Seu diário de bosses</span>
      </header>

      <div className="bosstiary-progress-stats">
        <article className="bosstiary-progress-stat">
          <strong>{summary.bossesDefeated}</strong>
          <small>Bosses derrotados</small>
        </article>
        <article className="bosstiary-progress-stat">
          <strong>{summary.dropsRegistered}</strong>
          <small>Drops registrados</small>
        </article>
        <article className="bosstiary-progress-stat">
          <strong>{summary.activitiesRegistered}</strong>
          <small>Caçadas registradas</small>
        </article>
        <article className="bosstiary-progress-stat">
          <strong>
            {summary.bossesTracked} / {summary.bossesCataloged || "—"}
          </strong>
          <small>Bosses acompanhados</small>
        </article>
      </div>

      <div className="bosstiary-progress-subtabs" role="tablist" aria-label="Visões do progresso">
        <button
          aria-selected={view === "mine"}
          className={`bosstiary-progress-subtab${view === "mine" ? " is-active" : ""}`}
          onClick={() => setView("mine")}
          role="tab"
          type="button"
        >
          Meu progresso
        </button>
        <button
          aria-selected={view === "all"}
          className={`bosstiary-progress-subtab${view === "all" ? " is-active" : ""}`}
          onClick={() => setView("all")}
          role="tab"
          type="button"
        >
          Todos os bosses
        </button>
        <button
          aria-selected={view === "party"}
          className={`bosstiary-progress-subtab${view === "party" ? " is-active" : ""}`}
          onClick={() => setView("party")}
          role="tab"
          type="button"
        >
          Partys
        </button>
      </div>

      {error ? <CatalogError description={error} onRetry={() => (view === "mine" ? loadMine() : loadChecklist())} /> : null}

      {view === "party" ? (
        <PartyPanel />
      ) : view === "mine" ? (
        <div className="bosstiary-progress-mine">
          <section className="bosstiary-progress-panel">
            <header className="bosstiary-progress-panel__head">
              <div>
                <h3>Registrar atividade</h3>
                <p>Marque um boss derrotado ou registre um drop que conquistou.</p>
              </div>
              <span className="subtle">Novo registro</span>
            </header>
            <form className="bosstiary-progress-form" onSubmit={onSubmit}>
              <Input
                aria-autocomplete="list"
                label="Boss"
                onChange={(event) => {
                  setSelectedBoss(null);
                  setBossSearch(event.target.value);
                }}
                placeholder="Buscar no catálogo ou informar um nome"
                value={selectedBoss?.name ?? bossSearch}
              />
              {bossHits.length > 0 && !selectedBoss ? (
                <ul className="bosstiary-progress-suggest">
                  {bossHits.map((boss) => (
                    <li key={boss.id}>
                      <button
                        onClick={() => {
                          setSelectedBoss(boss);
                          setBossSearch(boss.name);
                          setBossHits([]);
                        }}
                        type="button"
                      >
                        <CatalogImage alt="" name={boss.name} src={null} />
                        <span>{boss.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="bosstiary-progress-form__row">
                <Select
                  label="Tipo de registro"
                  onChange={(event) => setKind(event.target.value as BosstiaryActivityKind)}
                  options={[
                    { value: "BOSS_KILL", label: "Boss derrotado" },
                    { value: "DROP", label: "Drop obtido" },
                  ]}
                  value={kind}
                />
                <Input label="Data" onChange={(event) => setOccurredAt(event.target.value)} type="date" value={occurredAt} />
              </div>
              {kind === "DROP" ? (
                <div className="bosstiary-progress-form__row">
                  <Input label="Item" onChange={(event) => setItemName(event.target.value)} placeholder="Ex.: Falcon Circlet" value={itemName} />
                  <Input label="Quantidade" min={1} onChange={(event) => setItemQuantity(event.target.value)} type="number" value={itemQuantity} />
                </div>
              ) : null}
              <Select
                label="Party (opcional)"
                onChange={(event) => {
                  setPartyId(event.target.value);
                  setHuntSessionId("");
                }}
                options={[
                  { value: "", label: "Sem party" },
                  ...parties.map((item) => ({ value: item.id, label: item.name })),
                ]}
                value={partyId}
              />
              <Select
                label="Sessão de hunt (opcional)"
                onChange={(event) => setHuntSessionId(event.target.value)}
                options={[
                  { value: "", label: "Sem sessão" },
                  ...sessions.map((item) => ({ value: item.id, label: item.title })),
                ]}
                value={huntSessionId}
              />
              <Select
                label="Rotação (opcional)"
                onChange={(event) => setRotationId(event.target.value)}
                options={[
                  { value: "", label: "Sem rotação" },
                  ...rotations.map((rotation) => ({ value: rotation.id, label: rotation.title })),
                ]}
                value={rotationId}
              />
              <Select
                label="Visibilidade"
                onChange={(event) => setVisibility(event.target.value as BosstiaryVisibility)}
                options={[
                  { value: "PRIVATE", label: "Privado" },
                  { value: "PUBLIC", label: "Público" },
                  { value: "GROUP", label: "Grupo (somente a party/sessão)" },
                ]}
                value={visibility}
              />
              <Textarea label="Observação" onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
              {formError ? <p className="bosstiary-progress-form__error">{formError}</p> : null}
              <Button disabled={pending} type="submit">
                Salvar registro
              </Button>
            </form>
          </section>

          <section className="bosstiary-progress-panel">
            <header className="bosstiary-progress-panel__head">
              <div>
                <h3>Últimas atividades</h3>
                <p>Seu histórico pessoal de caçadas e conquistas.</p>
              </div>
              <span className="subtle">Histórico</span>
            </header>
            {loading && activities.length === 0 ? <CatalogLoading label="Carregando histórico" /> : null}
            {!loading && activities.length === 0 ? (
              <CatalogEmpty description="Registre um boss derrotado ou um drop para começar o diário." title="Nenhuma atividade ainda" />
            ) : null}
            <ul className="bosstiary-activity-list">
              {activities.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{activityTitle(row)}</strong>
                    <p>{activityMeta(row)}</p>
                    {editingId === row.id ? (
                      <div className="bosstiary-progress-form__row">
                        <Select
                          label="Visibilidade"
                          onChange={(event) => setEditVisibility(event.target.value as BosstiaryVisibility)}
                          options={[
                            { value: "PRIVATE", label: "Privado" },
                            { value: "PUBLIC", label: "Público" },
                            { value: "GROUP", label: "Grupo (somente a party/sessão)" },
                          ]}
                          value={editVisibility}
                        />
                        <Textarea label="Observação" onChange={(event) => setEditNote(event.target.value)} rows={2} value={editNote} />
                        <Button onClick={() => void saveEdit(row.id)} type="button" size="sm">
                          Salvar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="bosstiary-community-card__actions">
                    <Button onClick={() => startEdit(row)} size="sm" type="button" variant="ghost">
                      Editar
                    </Button>
                    <Button onClick={() => void onDelete(row.id)} size="sm" type="button" variant="ghost">
                      Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="bosstiary-progress-panel bosstiary-progress-panel--wide">
            <header className="bosstiary-progress-panel__head">
              <div>
                <h3>Meus drops</h3>
                <p>Informações declaradas por você. O Tibia não confirma automaticamente estes registros.</p>
              </div>
            </header>
            <div className="bosstiary-progress-toolbar">
              <Input label="Filtrar por boss ou item" onChange={(event) => setDropSearch(event.target.value)} value={dropSearch} />
              <Input label="De" onChange={(event) => setDropFrom(event.target.value)} type="date" value={dropFrom} />
              <Input label="Até" onChange={(event) => setDropTo(event.target.value)} type="date" value={dropTo} />
            </div>
            {drops.length === 0 ? (
              <CatalogEmpty description="Quando o tipo for Drop obtido, o item aparece aqui." title="Nenhum drop registrado" />
            ) : (
              <ul className="bosstiary-drops-grid">
                {drops.map((row) => (
                  <li key={row.id}>
                    <strong>{row.itemName}</strong>
                    <p>
                      {row.bossName} · x{row.itemQuantity} · {new Date(row.occurredAt).toLocaleDateString("pt-BR")}
                    </p>
                    <small>{visibilityLabel(row.visibility)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <section className="bosstiary-progress-panel">
          <header className="bosstiary-progress-panel__head">
            <div>
              <h3>Todos os bosses</h3>
              <p>Marque os bosses que você já derrotou. O histórico de atividades permanece independente.</p>
            </div>
            <span className="subtle">Seu checklist</span>
          </header>
          <div className="bosstiary-progress-toolbar">
            <Input
              label="Buscar boss pelo nome"
              onChange={(event) => {
                setCheckSearch(event.target.value);
              }}
              placeholder="Buscar boss pelo nome..."
              value={checkSearch}
            />
            <Select
              label="Filtro"
              onChange={(event) => {
                setCheckPage(1);
                setCheckFilter(event.target.value as "ALL" | "DONE" | "PENDING");
              }}
              options={[
                { value: "ALL", label: "Todos" },
                { value: "DONE", label: "Derrotados" },
                { value: "PENDING", label: "Pendentes" },
              ]}
              value={checkFilter}
            />
          </div>
          {loading && checklist.length === 0 ? <CatalogLoading label="Carregando checklist" /> : null}
          {!loading && checklist.length === 0 ? (
            <CatalogEmpty description="O checklist usa o catálogo revisado do Bosstiário." title="Nenhum boss nesta lista" />
          ) : null}
          <ul className="bosstiary-check-list">
            {checklist.map((item) => (
              <li key={item.bossId}>
                <CatalogImage alt="" className="bosstiary-check-list__art" name={item.name} src={item.image} />
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.officialCategory ?? "Categoria a validar"}
                    {item.lastDefeatedAt
                      ? ` · última vez ${new Date(item.lastDefeatedAt).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <Button
                  aria-pressed={item.defeated}
                  onClick={() => void toggleChecklist(item)}
                  type="button"
                  variant={item.defeated ? "primary" : "ghost"}
                >
                  {item.defeated ? "Derrotado" : "Pendente"}
                </Button>
              </li>
            ))}
          </ul>
          <Pagination
            onChange={setCheckPage}
            page={checkPage}
            totalPages={Math.max(1, Math.ceil(checkTotal / 20))}
          />
        </section>
      )}
    </section>
  );
}
