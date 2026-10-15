import { Platform } from "react-native";
import Purchases from "react-native-purchases";

let configured = false;
let configuredUserId = null;

function apiKeyForPlatform() {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
  }
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
  }
  return "";
}

export async function configureRevenueCatUser(userId) {
  const apiKey = apiKeyForPlatform();
  if (!apiKey || !userId || !["ios", "android"].includes(Platform.OS)) {
    return false;
  }

  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    configuredUserId = userId;
    return true;
  }

  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
  return true;
}

export async function logoutRevenueCatUser() {
  if (configured && configuredUserId) {
    await Purchases.logOut();
    configuredUserId = null;
  }
}

export async function getLifetimePremiumPackage(userId) {
  if (!(await configureRevenueCatUser(userId))) {
    return null;
  }
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return packages.find((item) => item.packageType === "LIFETIME") ?? null;
}

export async function purchaseRevenueCatPackage(aPackage) {
  return Purchases.purchasePackage(aPackage);
}

export async function restoreRevenueCatPurchases(userId) {
  if (!(await configureRevenueCatUser(userId))) {
    return null;
  }
  return Purchases.restorePurchases();
}
