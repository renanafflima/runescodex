import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CHARM_GUIDE_CATEGORIES,
  CHARM_GUIDE_DIFFICULTY_LABEL,
  charmGuideCategoryLabel,
  charmGuideCategoryPoints,
  formatRelativePt,
} from "../../domain/charm-guides";
import { describeApiError } from "../../services/api/errors";
import {
  getCharmGuideCategories,
  listCharmGuides,
  type CharmGuideCard,
  type CharmGuideCpCategory,
} from "../../services/api/charm-guides";
import { CatalogEmpty, CatalogError, CatalogLoading } from "../catalog/CatalogState";
import { Button, ButtonLink } from "../ui/Button";
import { Chip } from "../ui/Chip";

type CharmGuidesPanelProps = {
  onPublish: () => void;
};

export function CharmGuidesPanel({ onPublish }: CharmGuidesPanelProps) {
  const [categories, setCategories] = useState(CHARM_GUIDE_CATEGORIES.map((item) => ({
    ...item,
    guideCount: 0,
  })));
  const [guides, setGuides] = useState<CharmGuideCard[]>([]);
  const [filter, setFilter] = useState<CharmGuideCpCategory | "">("");
  const [sort, setSort] = useState<"RECENT" | "LIKED">("RECENT");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, page] = await Promise.all([
        getCharmGuideCategories(),
        listCharmGuides({
          cpCategory: filter,
          sort,
          page: 1,
          limit: showAll ? 30 : 3,
        }),
      ]);
      setCategories(
        CHARM_GUIDE_CATEGORIES.map((item) => ({
          ...item,
          guideCount:
            summary.categories.find((row) => row.cpCategory === item.cpCategory)?.guideCount ?? 0,
        })),
      );
      setGuides(page.items);
    } catch (err) {
      setError(describeApiError(err));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, [filter, showAll, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="charm-guides">
      <div className="section-head">
        <div>
          <div className="section-kicker">Escolha seu objetivo</div>
          <h2>Rotas de Charm Points</h2>
          <p>Guias organizados por categoria de Charm Points.</p>
        </div>
      </div>

      <div className="guide-grid">
        {categories.map((category) => (
          <article
            className="guide-card"
            key={category.cpCategory}
            style={{ ["--tone" as string]: category.tone }}
          >
            <div className="guide-main">
              <div className="guide-gem" aria-hidden>
                ✦
              </div>
              <div className="guide-info">
                <div className="cp">{category.targetPoints} CP</div>
                <h3>Guia {category.label}</h3>
                <p>{category.blurb}</p>
                <span className="difficulty">◆ {category.label}</span>
              </div>
            </div>
            <div className="guide-foot">
              <div className="meta">
                <span>
                  <b>{category.guideCount}</b> guias
                </span>
              </div>
              <Button
                onClick={() => {
                  setFilter(category.cpCategory);
                  setShowAll(true);
                }}
                type="button"
                variant="secondary"
              >
                Ver guias →
              </Button>
            </div>
          </article>
        ))}
      </div>

      <section className="community" aria-labelledby="community-guides-title">
        <div className="community-top">
          <div>
            <div className="section-kicker">Compartilhe e aprenda</div>
            <h2 id="community-guides-title">Guias da Comunidade</h2>
            <p></p>
          </div>
          <Button onClick={onPublish} type="button">
            ＋ Compartilhe sua estratégia
          </Button>
        </div>

        <div className="community-filters" aria-label="Filtrar guias">
          <Chip active={!filter} onClick={() => setFilter("")}>
            Todos os guias
          </Chip>
          {CHARM_GUIDE_CATEGORIES.map((category) => (
            <Chip
              active={filter === category.cpCategory}
              key={category.cpCategory}
              onClick={() => setFilter(category.cpCategory)}
            >
              {category.targetPoints} CP · {category.label}
            </Chip>
          ))}
        </div>

        <div className="chip-row" aria-label="Ordenação">
          <Chip active={sort === "RECENT"} onClick={() => setSort("RECENT")}>
            Mais recentes
          </Chip>
          <Chip active={sort === "LIKED"} onClick={() => setSort("LIKED")}>
            Mais curtidos
          </Chip>
        </div>

        {loading ? (
          <CatalogLoading label="Carregando guias" />
        ) : error ? (
          <CatalogError description={error} onRetry={() => void load()} />
        ) : guides.length === 0 ? (
          <CatalogEmpty
            description="Ainda não há guias publicados nesta categoria. Seja o primeiro a publicar."
            title="Nenhum guia encontrado"
          />
        ) : (
          <div className="posts">
            {guides.map((guide) => (
              <article className="post" key={guide.id}>
                <div className="post-top">
                  <div className="author">
                    <span className="avatar">{guide.author.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <div className="author-name">{guide.author.name}</div>
                      <div className="post-date">{formatRelativePt(guide.publishedAt || guide.createdAt)}</div>
                    </div>
                  </div>
                  <span className="post-type">
                    {charmGuideCategoryPoints(guide.cpCategory)} CP ·{" "}
                    {charmGuideCategoryLabel(guide.cpCategory)}
                  </span>
                </div>
                <h3>
                  <Link to={`/bestiary/guides/${guide.id}`}>{guide.title}</Link>
                </h3>
                <p>{guide.description}</p>
                <div className="post-tags">
                  <span>{guide.stepCount} etapas</span>
                  <span>{guide.uniqueCreatureCount} criaturas</span>
                  <span>{guide.totalCharmPoints} CP</span>
                  <span>{CHARM_GUIDE_DIFFICULTY_LABEL[guide.difficulty]}</span>
                </div>
                <div className="post-actions">
                  <span className="action">♡ {guide.likeCount} curtidas</span>
                  <span className="action">▢ {guide.commentCount} comentários</span>
                  <span className="action">☆ {guide.favoriteCount} salvos</span>
                  <ButtonLink
                    className="post-strategy-cta"
                    size="sm"
                    to={`/bestiary/guides/${guide.id}`}
                    variant="primary"
                  >
                    Ver estratégia completa →
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        )}

        {!showAll && guides.length >= 3 ? (
          <div className="community-more">
            <Button onClick={() => setShowAll(true)} type="button" variant="ghost">
              Ver todos os guias da comunidade →
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
