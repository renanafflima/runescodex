import { homeTriTechBanner } from "./home-content";

export function HomeTriTechBanner() {
  if (!homeTriTechBanner.active) return null;

  return (
    <a
      className="home-portal-tritech"
      href={homeTriTechBanner.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        alt={homeTriTechBanner.alt}
        className="home-portal-tritech__image"
        decoding="async"
        height={280}
        src={homeTriTechBanner.image}
        width={1200}
      />
    </a>
  );
}