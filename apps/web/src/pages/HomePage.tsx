import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Section } from "../components/layout/Section";
import { ButtonLink } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { assetUrl } from "../lib/assets";
import { apiConfiguration } from "../services/api/client";
import { useAuth } from "../auth/AuthContext";

const areas = [
  {
    id: "hunts",
    title: "Hunts",
    description: "Onde caçar agora",
    image: assetUrl("images/home/hunt.png"),
    to: "/hunts",
  },
  {
    id: "bestiary",
    title: "Bestiário",
    description: "Criaturas e spawns",
    image: assetUrl("images/home/bestiary.png"),
    to: "/bestiary",
  },
  {
    id: "forum",
    title: "Fórum",
    description: "Comunidade",
    image: assetUrl("images/home/forum.png"),
    to: null,
  },
  {
    id: "rewards",
    title: "Rewards",
    description: "Missões, pontos e conquistas",
    image: assetUrl("images/home/rewards.png"),
    to: null,
  },
] as const;

export function HomePage() {
  const { isAuthenticated, activeCharacter } = useAuth();
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <PageContainer className="home-hero__inner" size="wide">
          <div className="home-hero__content">
            <img
              alt=""
              className="home-hero__mark"
              height="92"
              src={assetUrl("images/brand/runescodex-icon.png")}
              width="92"
            />
            <p className="home-hero__welcome">Bem-vindo, Aventureiro.</p>
            <h1 className="home-hero__title" id="home-title">
              Mais que caçar,
              <span> é evoluir.</span>
            </h1>
            <p className="home-hero__lead">
              Hunts, bestiário e progresso em um só lugar.
            </p>
            <div className="home-hero__actions">
              <ButtonLink size="lg" to="/hunts">
                Começar agora
              </ButtonLink>
              <ButtonLink size="lg" to={isAuthenticated ? "/profile" : "/login"} variant="ghost">
                {isAuthenticated ? "Ver perfil" : "Acessar minha conta"}
              </ButtonLink>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer size="wide">
        <Section
          className="home-areas"
          eyebrow="Acesso rápido"
          id="areas"
          title="Sua jornada começa aqui"
        >
          <div className="feature-grid">
            {areas.map((area) => {
              const content = (
                <div className="feature-panel__content">
                  <img
                    alt=""
                    className="feature-panel__emblem"
                    height="72"
                    src={area.image}
                    width="72"
                  />
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                  {area.to ? null : <Badge>Em breve</Badge>}
                </div>
              );

              if (area.to) {
                return (
                  <Link
                    className={`feature-panel feature-panel--${area.id}`}
                    id={area.id}
                    key={area.id}
                    to={area.to}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <article
                  className={`feature-panel feature-panel--${area.id}`}
                  id={area.id}
                  key={area.id}
                >
                  {content}
                </article>
              );
            })}
          </div>
        </Section>

        <section className="journey-callout" aria-labelledby="journey-title">
          <div className="journey-callout__content">
            <span className="eyebrow">Perfil</span>
            <h2 id="journey-title">Personagens, conta e evolução.</h2>
            <p>
              {activeCharacter
                ? `${activeCharacter.name} está ativo: ${activeCharacter.vocation} ${activeCharacter.level}.`
                : "O mesmo progresso do aplicativo, pronto para continuar em qualquer tela."}
            </p>
            <ButtonLink to="/profile" variant="secondary">
              Ver perfil
            </ButtonLink>
          </div>
        </section>

        <div className="system-status" role="status">
          <span className="system-status__dot" aria-hidden="true" />
          <span>Ambiente Web/PWA</span>
          <strong>
            API {apiConfiguration.configured ? "configurada" : "não configurada"}
          </strong>
        </div>
      </PageContainer>
    </div>
  );
}
