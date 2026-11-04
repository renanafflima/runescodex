import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { BosstiaryComments } from "../components/bosstiary/BosstiaryComments";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { loadBosstiaryCatalog } from "../domain/bosstiary-catalog";
import {
  accessLabel,
  bossPartyLabel,
  difficultyLabel,
  factKind,
  factKindLabel,
  formatCooldown,
  formatMinutes,
  mergeBosstiaryProfile,
  type BosstiaryEntry,
  type BosstiaryFactKind,
} from "../domain/bosstiary";
import { ApiError, describeApiError } from "../services/api/errors";
import { recordContentView } from "../services/api/admin-portal";
import { getBosstiaryProfile } from "../services/api/bosstiary";

export function BosstiaryBossPage() {
  const { slug = "" } = useParams();
  const [entry, setEntry] = useState<BosstiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    try {
      const catalog = loadBosstiaryCatalog();
      const local = catalog.entries.find((item) => item.slug === slug) ?? null;
      void getBosstiaryProfile(slug)
        .then((profile) => {
          if (!active) return;
          setEntry(
            mergeBosstiaryProfile(local ?? blankEntry(slug, profile.name), {
              slug: profile.slug,
              officialCategory: profile.officialCategory,
              huntMode: profile.huntMode,
              recommendedLevelSolo: profile.recommendedLevelSolo,
              recommendedLevelParty: profile.recommendedLevelParty,
              difficulty: profile.difficulty,
              locationName: profile.locationName,
              locationRegion: profile.locationRegion,
              originCity: profile.originCity,
              accessStatus: profile.accessStatus,
              accessRequirements: profile.accessRequirements,
              howToReach: profile.howToReach,
              cooldownSeconds: profile.cooldownSeconds,
              estimatedCombatMinutes: profile.estimatedCombatMinutes,
              bossPoints: profile.bossPoints,
              mechanics: profile.mechanics,
              strategy: profile.strategy,
            }),
          );
        })
        .catch((err) => {
          if (!active) return;
          if (local) {
            setEntry(local);
            return;
          }
          setEntry(null);
          setError(err instanceof ApiError && err.status === 404 ? "Boss não encontrado." : describeApiError(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } catch (err) {
      setEntry(null);
      setError(err instanceof Error ? err.message : "Não foi possível ler o Bosstiário.");
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (entry?.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) {
      recordContentView("BOSS", entry.slug);
    }
  }, [entry?.slug]);

  const facts = useMemo(() => (entry ? detailFacts(entry) : []), [entry]);

  return (
    <div className="catalog-page catalog-page--bosstiary bosstiary-detail-page">
      <section className="catalog-hero catalog-hero--bosstiary" aria-labelledby="boss-title">
        <PageContainer className="catalog-hero__inner" size="wide">
          <Link className="bosstiary-back" to="/bosstiary">
            Voltar ao Bosstiário
          </Link>
          <span className="eyebrow">Ficha do boss</span>
          <h1 id="boss-title">{entry?.name ?? "Boss"}</h1>
          <p>
            Comentários ficam nesta ficha. Recomendações de level são editoriais do RuneCodex, não requisitos oficiais
            do Tibia.
          </p>
        </PageContainer>
      </section>
      <PageContainer className="catalog-body bosstiary-body" size="wide">
        {loading ? (
          <CatalogLoading label="Carregando ficha do boss" />
        ) : error ? (
          <CatalogError description={error} />
        ) : !entry ? (
          <CatalogEmpty description="Esse slug não está no catálogo de candidatos nem em um perfil revisado." title="Boss não encontrado" />
        ) : (
          <>
            <article className="bosstiary-sheet">
              <CatalogImage alt="" className="bosstiary-sheet__art" name={entry.name} src={entry.imageUrl} />
              <div>
                <div className="catalog-card__meta">
                  <Badge tone={entry.party ? "gold" : "neutral"}>
                    {bossPartyLabel(entry.party) ?? "Classificação pendente"}
                  </Badge>
                  {entry.officialCategory ? <Badge tone="info">{entry.officialCategory}</Badge> : null}
                  {entry.source === "tibiawiki-candidate" ? <Badge>Candidato TibiaWiki</Badge> : <Badge tone="gold">Perfil revisado</Badge>}
                </div>
                <dl className="bosstiary-sheet__facts">
                  {facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>
                        {fact.label}
                        <span className={`bosstiary-fact bosstiary-fact--${fact.kind}`}>{factKindLabel(fact.kind)}</span>
                      </dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
            <BosstiaryComments slug={entry.slug} />
          </>
        )}
      </PageContainer>
    </div>
  );
}

function detailFacts(entry: BosstiaryEntry) {
  return [
    { label: "Informações gerais", kind: factKind(entry.isboss, "official"), value: entry.sourceUrl ? `${entry.name} · origem TibiaWiki isboss = ${entry.isboss}` : entry.name },
    { label: "Categoria do Bosstiário", kind: factKind(entry.officialCategory, "official"), value: entry.officialCategory ?? "Categoria oficial ainda não validada." },
    { label: "Localização", kind: factKind(entry.location, "official"), value: [entry.location, entry.locationRegion, entry.originCity].filter(Boolean).join(" · ") || "Localização ainda não cadastrada." },
    { label: "Como chegar", kind: factKind(entry.howToReach, "official"), value: entry.howToReach ?? "Rota de acesso ainda não cadastrada." },
    { label: "Requisitos de acesso", kind: factKind(entry.accessRequirements ?? (entry.accessStatus === "NONE" ? "none" : null), "official"), value: entry.accessRequirements ?? accessLabel(entry.accessStatus) ?? "Acesso ainda não revisado. Não assumimos que você possui o requisito." },
    { label: "Cooldown", kind: factKind(entry.cooldownSeconds, "official"), value: formatCooldown(entry.cooldownSeconds) ?? "Cooldown oficial ainda sem fonte no RuneCodex. Não é tempo de combate." },
    { label: "Mecânicas e habilidades", kind: factKind(entry.mechanics, "editorial"), value: entry.mechanics ?? "Mecânicas ainda não cadastradas." },
    { label: "Estratégia recomendada", kind: factKind(entry.strategy, "editorial"), value: entry.strategy ?? "Estratégia ainda não cadastrada." },
    { label: "Level recomendado para Solo", kind: factKind(entry.recommendedLevelSolo ?? (entry.party === "solo" ? entry.recommendedLevel : null), "editorial"), value: formatRecommended(entry.recommendedLevelSolo ?? (entry.party === "solo" ? entry.recommendedLevel : null)) },
    { label: "Level recomendado para Grupo", kind: factKind(entry.recommendedLevelParty ?? (entry.party === "party" ? entry.recommendedLevel : null), "editorial"), value: formatRecommended(entry.recommendedLevelParty ?? (entry.party === "party" ? entry.recommendedLevel : null)) },
    { label: "Tempo médio de combate", kind: factKind(entry.estimatedCombatMinutes, "estimated"), value: formatMinutes(entry.estimatedCombatMinutes) ? `${formatMinutes(entry.estimatedCombatMinutes)} · estimativa revisada, não confundir com cooldown.` : "Tempo de combate ainda sem estimativa revisada." },
    { label: "Boss Points", kind: factKind(entry.bossPoints, "official"), value: entry.bossPoints == null ? "Sem fonte de Boss Points no RuneCodex." : String(entry.bossPoints) },
    { label: "Dificuldade", kind: factKind(entry.difficulty, "editorial"), value: difficultyLabel(entry.difficulty) ?? "Dificuldade editorial ainda não revisada." },
  ] satisfies Array<{ label: string; kind: BosstiaryFactKind; value: string }>;
}

function formatRecommended(level: number | null) {
  if (level == null) return "Sem recomendação editorial do RuneCodex. Não é nível mínimo oficial.";
  return `Recomendação do RuneCodex: ${level}. Não é nível mínimo oficial.`;
}

function blankEntry(slug: string, name: string): BosstiaryEntry {
  return {
    name,
    slug,
    sourceUrl: "",
    isboss: "sim",
    source: "tibiawiki-candidate",
    party: null,
    recommendedLevel: null,
    recommendedLevelSolo: null,
    recommendedLevelParty: null,
    imageUrl: null,
    rewards: [],
    location: null,
    locationRegion: null,
    originCity: null,
    bossPoints: null,
    officialCategory: null,
    difficulty: null,
    accessStatus: null,
    accessRequirements: null,
    howToReach: null,
    cooldownSeconds: null,
    estimatedCombatMinutes: null,
    mechanics: null,
    strategy: null,
  };
}
