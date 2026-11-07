import type { ProfileMeResponse } from "../services/api/profile";

export function isEmblemUnlocked(
  emblems: ProfileMeResponse["emblems"],
  emblemId: string,
) {
  if (emblems.criteriaStatus === "PENDING") return false;
  return emblems.unlockedIds.includes(emblemId);
}

export function emblemProgressLabel(emblems: ProfileMeResponse["emblems"]) {
  const unlocked =
    emblems.criteriaStatus === "PENDING" ? 0 : emblems.unlockedCount;
  const total = emblems.catalogTotal;
  return `${unlocked} / ${total} conquistadas`;
}
