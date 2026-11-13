import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CatalogImage } from "../components/catalog/CatalogImage";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../components/catalog/CatalogState";
import { BosstiaryComments } from "../components/bosstiary/BosstiaryComments";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { loadBosstiaryCatalog } from "../domain/bosstiary-catalog";
import {
  bossCombatStrategyText,
  bossLootText,
  factKind,
  factKindLabel,
  formatBosstiaryLocationLine,
  formatBosstiaryReachLine,
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
                  {entry.source === "tibiawiki-candidate" ? (
                    <Badge>Candidato TibiaWiki</Badge>
                  ) : (
                    <Badge tone="gold">Perfil revisado</Badge>
                  )}
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

function sheetValue(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

export function detailFacts(entry: BosstiaryEntry) {
  const loot = bossLootText(entry);
  const combatStrategy = bossCombatStrategyText(entry);

  const facts: Array<{ label: string; kind: BosstiaryFactKind; value: string }> = [
    {
      label: "Categoria do Bosstiário",
      kind: factKind(entry.officialCategory, "official"),
      value: sheetValue(entry.officialCategory),
    },
    {
      label: "Nível recomendado (Solo)",
      kind: factKind(entry.recommendedLevelSolo, "editorial"),
      value: entry.recommendedLevelSolo != null ? String(entry.recommendedLevelSolo) : "—",
    },
    {
      label: "Nível recomendado (Party)",
      kind: factKind(entry.recommendedLevelParty, "editorial"),
      value: entry.recommendedLevelParty != null ? String(entry.recommendedLevelParty) : "—",
    },
    {
      label: "Localização",
      kind: factKind(formatBosstiaryLocationLine(entry), "official"),
      value: sheetValue(formatBosstiaryLocationLine(entry)),
    },
    {
      label: "Como chegar / acesso",
      kind: factKind(formatBosstiaryReachLine(entry), "official"),
      value: sheetValue(formatBosstiaryReachLine(entry)),
    },
  ];

  if (loot) {
    facts.push({
      label: "Recompensas / drops",
      kind: factKind(loot, "official"),
      value: loot,
    });
  } else if (!combatStrategy) {
    facts.push({
      label: "Recompensas / drops",
      kind: "pending",
      value: "—",
    });
  }

  if (combatStrategy) {
    facts.push({
      label: "Estratégia recomendada",
      kind: factKind(combatStrategy, "editorial"),
      value: combatStrategy,
    });
  }

  facts.push({
    label: "Mecânicas",
    kind: factKind(entry.mechanics, "editorial"),
    value: sheetValue(entry.mechanics),
  });

  return facts;
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
