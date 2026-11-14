import { PageContainer } from "../components/layout/PageContainer";
import { HomeAdSlot } from "../components/home/HomeAdSlot";
import { HomeCampaignBanner } from "../components/home/HomeCampaignBanner";
import { HomeCommunityHighlights } from "../components/home/HomeCommunityHighlights";
import { HomeNews } from "../components/home/HomeNews";
import { HomeRewardsPromo } from "../components/home/HomeRewardsPromo";
import { HomeShortcuts } from "../components/home/HomeShortcuts";
import { homeAdCampaigns } from "../components/home/home-content";
import { apiConfiguration } from "../services/api/client";

function adSlot(slot: "primary" | "middle" | "bottom") {
  return homeAdCampaigns
    .filter((campaign) => campaign.slot === slot)
    .map((campaign) => <HomeAdSlot key={campaign.slot} {...campaign} />);
}

export function HomePage() {
  return (
    <div className="home-page home-portal">
      <HomeCampaignBanner />
      <PageContainer className="home-portal__body" size="wide">
        {adSlot("primary")}
        <HomeShortcuts />
        {adSlot("middle")}
        <HomeNews />
        <HomeCommunityHighlights />
        <HomeRewardsPromo />
        {adSlot("bottom")}
        <div className="system-status" role="status">
          <span className="system-status__dot" aria-hidden="true" />
          <span>Ambiente Web/PWA</span>
          <strong>API {apiConfiguration.configured ? "configurada" : "não configurada"}</strong>
        </div>
      </PageContainer>
    </div>
  );
}
