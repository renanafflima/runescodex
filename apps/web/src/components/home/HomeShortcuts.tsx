import { Link } from "react-router-dom";
import { Section } from "../layout/Section";
import { homeShortcuts } from "./home-content";

export function HomeShortcuts() {
  return (
    <Section
      className="home-portal-shortcuts"
      eyebrow="Acesso rápido"
      id="areas"
      title="Sua jornada começa aqui"
    >
      <div className="home-portal-shortcuts__grid">
        {homeShortcuts.map((area) => (
          <Link
            className={`home-portal-shortcut home-portal-shortcut--${area.id}`}
            id={area.id}
            key={area.id}
            to={area.to}
          >
            <img alt="" className="home-portal-shortcut__image" src={area.image} />
            <span aria-hidden="true" className="home-portal-shortcut__overlay" />
            <div className="home-portal-shortcut__content">
              <h3>{area.title}</h3>
              <p>{area.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}