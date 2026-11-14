import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { assetUrl } from "../../lib/assets";
import { PageContainer } from "../layout/PageContainer";
import { ButtonLink } from "../ui/Button";
import { HomeInstallCta } from "./HomeInstallCta";

export function HomeCampaignBanner() {
  const { isAuthenticated, user } = useAuth();
  const startTo = !isAuthenticated ? "/login" : user?.premium?.access ? "/hunts" : "/checkout";

  return (
    <section className="home-portal-hero" aria-labelledby="home-title">
      <PageContainer className="home-portal-hero__inner" size="wide">
        <div className="home-portal-hero__content">
          <img
            alt=""
            className="home-portal-hero__mark"
            height="92"
            src={assetUrl("images/brand/runescodex-icon.png")}
            width="92"
          />
          <p className="home-portal-hero__welcome">Bem-vindo, Aventureiro.</p>
          <h1 className="home-portal-hero__title" id="home-title">
            Mais que caçar,
            <span> é evoluir.</span>
          </h1>
          <p className="home-portal-hero__lead">
            Portal MMORPG com hunts, bestiário, bosses, rewards e comunidade.
          </p>
          <div className="home-portal-hero__actions">
            <ButtonLink
              size="lg"
              state={!isAuthenticated ? { from: startTo === "/login" ? "/hunts" : startTo } : undefined}
              to={startTo}
            >
              Começar agora
            </ButtonLink>
            {isAuthenticated ? (
              <ButtonLink size="lg" to="/profile" variant="ghost">
                Ver perfil
              </ButtonLink>
            ) : (
              <Link className="button button--lg button--ghost" state={{ from: "/" }} to="/login">
                <span>Acessar minha conta</span>
              </Link>
            )}
          </div>
          <HomeInstallCta />
        </div>
      </PageContainer>
    </section>
  );
}
