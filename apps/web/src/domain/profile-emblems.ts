import { assetUrl } from "../lib/assets";

export type ProfileEmblem = {
  id: string;
  name: string;
  image: string;
  summary: string;
};

export const EMBLEM_CRITERION =
  "O critério de desbloqueio ainda não foi aprovado. O servidor não concede este emblema e o estado permanece fechado.";

export const PROFILE_EMBLEMS: ProfileEmblem[] = [
  {
    id: "primeiros-passos",
    name: "Primeiros Passos",
    image: assetUrl("images/profile/emblems/primeirospassos.png"),
    summary: "O primeiro marco visual da jornada no RuneCodex.",
  },
  {
    id: "aventureiro",
    name: "Aventureiro",
    image: assetUrl("images/profile/emblems/aventureiro.png"),
    summary: "Emblema de quem segue adiante na jornada.",
  },
  {
    id: "explorador",
    name: "Explorador",
    image: assetUrl("images/profile/emblems/explorador.png"),
    summary: "Emblema ligado à exploração do codex.",
  },
  {
    id: "cacador",
    name: "Caçador",
    image: assetUrl("images/profile/emblems/cacador.png"),
    summary: "Emblema ligado às hunts e à caça.",
  },
  {
    id: "mestre-das-criaturas",
    name: "Mestre das Criaturas",
    image: assetUrl("images/profile/emblems/mestredascriaturas.png"),
    summary: "Emblema ligado ao conhecimento das criaturas.",
  },
  {
    id: "erudito",
    name: "Erudito",
    image: assetUrl("images/profile/emblems/erudito.png"),
    summary: "Emblema ligado ao estudo do bestiário.",
  },
  {
    id: "estrategista",
    name: "Estrategista",
    image: assetUrl("images/profile/emblems/estrategista.png"),
    summary: "Emblema ligado à leitura de hunts e rotas.",
  },
  {
    id: "forjador-de-conhecimento",
    name: "Forjador de Conhecimento",
    image: assetUrl("images/profile/emblems/forjadordeconhecimento.png"),
    summary: "Emblema ligado a quem contribui com o conhecimento.",
  },
  {
    id: "baluarte-da-comunidade",
    name: "Baluarte da Comunidade",
    image: assetUrl("images/profile/emblems/baluartedacomunidade.png"),
    summary: "Emblema ligado à participação na comunidade.",
  },
  {
    id: "veterano",
    name: "Veterano",
    image: assetUrl("images/profile/emblems/veterano.png"),
    summary: "Emblema de permanência na jornada.",
  },
  {
    id: "lenda-do-runecodex",
    name: "Lenda do RuneCodex",
    image: assetUrl("images/profile/emblems/lendadorunes.png"),
    summary: "Emblema maior da identidade do RuneCodex.",
  },
  {
    id: "legado",
    name: "Legado",
    image: assetUrl("images/profile/emblems/legado.png"),
    summary: "Emblema reservado ao legado da jornada.",
  },
];
