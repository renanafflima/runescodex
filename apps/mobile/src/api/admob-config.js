import { Platform } from "react-native";

export function pickRewardedAdUnit(prepareResponse) {
  if (!prepareResponse) return null;
  const units = prepareResponse.adUnits ?? {};
  return Platform.OS === "ios" ? units.ios : units.android;
}
