import { PageContainer } from "../components/layout/PageContainer";
import { HomeAdSlot } from "../components/home/HomeAdSlot";
import { HomeCommunityHighlights } from "../components/home/HomeCommunityHighlights";
import { HomeNews } from "../components/home/HomeNews";
import { HomePartnerCarousel } from "../components/home/HomePartnerCarousel";
import { HomeRewardsPromo } from "../components/home/HomeRewardsPromo";
import { HomeShortcuts } from "../components/home/HomeShortcuts";
import { HomeTriTechBanner } from "../components/home/HomeTriTechBanner";
import { homeAdCampaigns } from "../components/home/home-content";
import { apiConfiguration } from "../services/api/client";

function adSlot(slot: "primary" | "middle" | "bottom") {
  return homeAdCampaigns
    .filter((campaign) => campaign.active && campaign.slot === slot)
    .map((campaign) => <HomeAdSlot key={campaign.slot} {...campaign} />);
}

export function HomePage() {
  return (
    <div className="home-page home-portal">
      <HomePartnerCarousel />
      <PageContainer className="home-portal__body" size="wide">
        {adSlot("primary")}
        <HomeShortcuts />
        <HomeNews />
        <HomeCommunityHighlights />
        <HomeRewardsPromo />
        <HomeTriTechBanner />
        <div className="system-status" role="status">
          <span className="system-status__dot" aria-hidden="true" />
          <span>Ambiente Web/PWA</span>
          <strong>API {apiConfiguration.configured ? "configurada" : "não configurada"}</strong>
        </div>
      </PageContainer>
    </div>
  );
}