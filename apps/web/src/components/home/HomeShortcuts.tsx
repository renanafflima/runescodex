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
            <img alt="" className="home-portal-shortcut__emblem" height="72" src={area.image} width="72" />
            <h3>{area.title}</h3>
            <p>{area.description}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
