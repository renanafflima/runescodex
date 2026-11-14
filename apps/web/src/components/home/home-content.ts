import { assetUrl } from "../../lib/assets";

export type HomeShortcut = {
  description: string;
  id: string;
  image: string;
  title: string;
  to: string;
};

export type HomeEditorialItem = {
  excerpt: string;
  id: string;
  title: string;
  to: string;
};

export type HomeAdCampaign = {
  active: boolean;
  campaignType: "season" | "sponsor" | "house";
  href?: string;
  image?: string;
  slot: "primary" | "middle" | "bottom";
  title: string;
};

export type HomePartnerBanner = {
  active: boolean;
  alt: string;
  campaignId: string;
  external?: boolean;
  href?: string;
  id: string;
  image: string;
};

export type HomeInstitutionalBanner = {
  active: boolean;
  alt: string;
  href: string;
  image: string;
};

export const homePartnerBanners: HomePartnerBanner[] = [
  {
    id: "partner-runescodex",
    campaignId: "parceria-runescodex",
    active: true,
    alt: "Campanha de parceria RuneCodex",
    image: assetUrl("images/home/banner_parceria_runescodex.png"),
    // href: "/parcerias", — habilitar quando a rota de contato estiver publicada.
  },
];

export const homeTriTechBanner: HomeInstitutionalBanner = {
  active: true,
  alt: "TriTech — Soluções Digitais que Conectam o Mundo",
  href: "https://tritech.app.br",
  image: assetUrl("images/home/tritech-institutional-banner.png"),
};

export const homeShortcuts: HomeShortcut[] = [
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
    id: "bosstiary",
    title: "Bosstiário",
    description: "Bosses, progresso e rotas",
    image: assetUrl("images/bosstiary/nav-enciclopedia.jpg"),
    to: "/bosstiary",
  },
  {
    id: "charms",
    title: "Charm Guides",
    description: "Guias para completar charms",
    image: assetUrl("images/forum/dicas.png"),
    to: "/bestiary",
  },
  {
    id: "rewards",
    title: "Rewards",
    description: "Missões, pontos e conquistas",
    image: assetUrl("images/home/rewards.png"),
    to: "/rewards",
  },
  {
    id: "community",
    title: "Comunidade",
    description: "Fórum e rotas compartilhadas",
    image: assetUrl("images/home/forum.png"),
    to: "/forum",
  },
];

export const editorialNews: HomeEditorialItem[] = [
  {
    id: "news-charms",
    title: "Charm Guides no Bestiário",
    excerpt: "Abra o Bestiário para ler guias da comunidade e planejar seus charms.",
    to: "/bestiary",
  },
  {
    id: "news-hunts",
    title: "Hunts revisadas para a temporada",
    excerpt: "Consulte vocações, lucro e proteção antes de sair para caçar.",
    to: "/hunts",
  },
  {
    id: "news-bosstiary",
    title: "Bosstiário com progresso e enciclopédia",
    excerpt: "Acompanhe bosses, rotas da comunidade e o seu progresso.",
    to: "/bosstiary",
  },
];

export const editorialCommunity: HomeEditorialItem[] = [
  {
    id: "community-forum",
    title: "Discussões do fórum",
    excerpt: "Dicas de hunt, profit e bestiário publicadas pela comunidade.",
    to: "/forum",
  },
  {
    id: "community-rotations",
    title: "Rotas de bosses",
    excerpt: "Veja rotas solo e em party compartilhadas no Bosstiário.",
    to: "/bosstiary",
  },
];

export const homeAdCampaigns: HomeAdCampaign[] = [
  {
    slot: "primary",
    active: true,
    campaignType: "season",
    title: "Campanha da temporada — evolua com Rewards",
    href: "/rewards",
    image: assetUrl("images/home/rewards.png"),
  },
];
