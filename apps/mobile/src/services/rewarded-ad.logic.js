export const REWARDED_AD_STATES = {
  IDLE: "IDLE",
  LOADING: "LOADING",
  READY: "READY",
  SHOWING: "SHOWING",
  AWAITING_CONFIRMATION: "AWAITING_CONFIRMATION",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
  UNAVAILABLE: "UNAVAILABLE",
};

export function nextRewardedAdState(current, event) {
  if (event === "reset") return REWARDED_AD_STATES.IDLE;
  if (event === "load") {
    if (current === REWARDED_AD_STATES.IDLE || current === REWARDED_AD_STATES.ERROR) {
      return REWARDED_AD_STATES.LOADING;
    }
    return current;
  }
  if (event === "loaded") {
    return REWARDED_AD_STATES.READY;
  }
  if (event === "show") {
    if (current === REWARDED_AD_STATES.READY) return REWARDED_AD_STATES.SHOWING;
    return current;
  }
  if (event === "earned") {
    if (current === REWARDED_AD_STATES.SHOWING) {
      return REWARDED_AD_STATES.AWAITING_CONFIRMATION;
    }
    return current;
  }
  if (event === "confirmed") {
    return REWARDED_AD_STATES.COMPLETED;
  }
  if (event === "unavailable") {
    return REWARDED_AD_STATES.UNAVAILABLE;
  }
  if (event === "error") {
    return REWARDED_AD_STATES.ERROR;
  }
  if (event === "closed_early") {
    if (current === REWARDED_AD_STATES.SHOWING) return REWARDED_AD_STATES.READY;
    return current;
  }
  return current;
}
