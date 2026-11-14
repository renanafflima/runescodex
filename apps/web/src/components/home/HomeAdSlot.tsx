import { Link } from "react-router-dom";
import type { HomeAdCampaign } from "./home-content";

type HomeAdSlotProps = HomeAdCampaign;

export function HomeAdSlot({
  active = true,
  campaignType,
  href,
  image,
  slot,
  title,
}: HomeAdSlotProps) {
  if (!active) return null;

  const body = (
    <>
      {image ? <img alt="" className="home-portal-ad__art" src={image} /> : null}
      <div className="home-portal-ad__copy">
        <span className="eyebrow">{campaignType === "house" ? "RuneCodex" : "Campanha"}</span>
        <strong>{title}</strong>
      </div>
    </>
  );

  const className = `home-portal-ad home-portal-ad--${slot}`;

  if (href) {
    return (
      <Link className={className} to={href}>
        {body}
      </Link>
    );
  }

  return (
    <aside className={className} data-campaign-type={campaignType}>
      {body}
    </aside>
  );
}
