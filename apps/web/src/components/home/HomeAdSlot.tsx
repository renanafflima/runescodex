import { Link } from "react-router-dom";
import type { HomePromoCampaign } from "./home-content";

type HomeAdSlotProps = HomePromoCampaign;

export function HomeAdSlot({
  active = true,
  description,
  eyebrow,
  href,
  image,
  imageAlt = "",
  slot,
  theme = "default",
  title,
}: HomeAdSlotProps) {
  if (!active) return null;

  const body = (
    <>
      {image ? (
        <img alt={imageAlt} className="home-portal-promo__art" height="80" src={image} width="80" />
      ) : null}
      <div className="home-portal-promo__copy">
        <span className="home-portal-promo__eyebrow">{eyebrow}</span>
        <strong className="home-portal-promo__title">{title}</strong>
        <p className="home-portal-promo__description">{description}</p>
      </div>
    </>
  );

  const className = `home-portal-promo home-portal-promo--${slot} home-portal-promo--${theme}`;

  if (href) {
    return (
      <Link className={className} to={href}>
        {body}
      </Link>
    );
  }

  return <aside className={className}>{body}</aside>;
}