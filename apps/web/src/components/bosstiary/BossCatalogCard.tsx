import { Link } from "react-router-dom";
import { CatalogImage } from "../catalog/CatalogImage";
import { Badge } from "../ui/Badge";
import { bossPartyLabel, type BosstiaryEntry } from "../../domain/bosstiary";

export function BossCatalogCard({ entry }: { entry: BosstiaryEntry }) {
  const party = bossPartyLabel(entry.party);
  return (
    <Link className="catalog-card bosstiary-card" to={`/bosstiary/${entry.slug}`}>
      <CatalogImage alt="" className="catalog-card__art" name={entry.name} src={entry.imageUrl} />
      <div className="catalog-card__body">
        <div className="catalog-card__meta">
          <Badge tone={party ? "gold" : "neutral"}>{party ?? "Classificação pendente"}</Badge>
          {entry.recommendedLevel ? (
            <Badge tone="info">Recomendação RuneCodex · {entry.recommendedLevel}</Badge>
          ) : (
            <Badge>Nível não revisado</Badge>
          )}
        </div>
        <h2>{entry.name}</h2>
        <p>Candidato TibiaWiki · isboss = {entry.isboss}</p>
      </div>
    </Link>
  );
}
