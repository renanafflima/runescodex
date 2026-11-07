import { Link } from "react-router-dom";
import { CatalogImage } from "../catalog/CatalogImage";
import { CatalogEmpty } from "../catalog/CatalogState";
import { resolveCreatureImage } from "../../domain/creature-image";
import type { ProfileFeaturedCreature } from "../../services/api/profile";

type ProfileFeaturedBestiaryProps = {
  featured: ProfileFeaturedCreature | null;
};

function completedCopy(featured: ProfileFeaturedCreature) {
  if (!featured.completed) {
    return `Em progresso · ${featured.kills} mortes registradas`;
  }
  if (featured.completedAt) {
    const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
      new Date(featured.completedAt),
    );
    return `Concluída em ${date} · ${featured.kills} mortes`;
  }
  return `Concluída · ${featured.kills} mortes`;
}

export function ProfileFeaturedBestiary({ featured }: ProfileFeaturedBestiaryProps) {
  return (
    <section aria-labelledby="profile-featured-title" className="profile-panel profile-featured">
      <div className="profile-section-head">
        <div>
          <h2 id="profile-featured-title">Bestiário em destaque</h2>
          <p className="profile-section-lead">Uma criatura que representa sua jornada atual no Bestiário.</p>
        </div>
      </div>

      {featured ? (
        <div className="profile-featured__card">
          <CatalogImage
            alt=""
            className="profile-featured__art"
            name={featured.name}
            src={resolveCreatureImage(featured.slug, featured.name)}
          />
          <div className="profile-featured__copy">
            <h3>{featured.name}</h3>
            <p>{completedCopy(featured)}</p>
            <Link className="profile-featured__link" to={`/bestiary/${featured.slug}`}>
              Abrir no Bestiário
            </Link>
          </div>
        </div>
      ) : (
        <CatalogEmpty
          description="Quando houver progresso no Bestiário, a criatura em destaque aparecerá aqui."
          title="Nenhuma criatura em destaque"
        />
      )}
    </section>
  );
}
