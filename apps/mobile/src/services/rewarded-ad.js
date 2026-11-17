import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  RewardedAd,
  RewardedAdEventType,
  MobileAds,
} from "react-native-google-mobile-ads";
import { nextRewardedAdState, REWARDED_AD_STATES } from "./rewarded-ad.logic";

let sdkReady = false;
let activeAd = null;
let activeSessionId = null;
let state = REWARDED_AD_STATES.IDLE;
let loadPromise = null;
let showing = false;

function extra() {
  return Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
}

export function rewardedAdUnitId() {
  const config = extra();
  return Platform.OS === "ios"
    ? config.admobRewardedIos
    : config.admobRewardedAndroid;
}

export function getRewardedAdState() {
  return state;
}

function setState(event) {
  state = nextRewardedAdState(state, event);
  return state;
}

export async function initializeRewardedAds() {
  if (sdkReady) return;
  await MobileAds().initialize();
  sdkReady = true;
}

export function resetRewardedAdRuntime() {
  activeAd = null;
  activeSessionId = null;
  loadPromise = null;
  showing = false;
  state = REWARDED_AD_STATES.IDLE;
}

function detachAdListeners(ad) {
  if (!ad?._rcListeners) return;
  for (const [type, handler] of ad._rcListeners) {
    ad.removeAdEventListener(type, handler);
  }
  ad._rcListeners = [];
}

function attachListener(ad, type, handler) {
  ad.addAdEventListener(type, handler);
  ad._rcListeners = ad._rcListeners ?? [];
  ad._rcListeners.push([type, handler]);
}

export async function loadRewardedAd(session) {
  if (showing) {
    throw new Error("AD_SHOW_IN_PROGRESS");
  }
  if (loadPromise) {
    return loadPromise;
  }
  const adUnitId = session?.adUnitId ?? rewardedAdUnitId();
  if (!adUnitId) {
    setState("unavailable");
    throw new Error("AD_UNIT_MISSING");
  }

  await initializeRewardedAds();
  setState("load");

  loadPromise = new Promise((resolve, reject) => {
    if (activeAd) {
      detachAdListeners(activeAd);
      activeAd = null;
    }

    const ad = RewardedAd.createForAdRequest(adUnitId, {
      serverSideVerificationOptions: {
        customData: session.customData,
      },
    });
    activeSessionId = session.sessionId;

    const onLoaded = () => {
      setState("loaded");
      activeAd = ad;
      loadPromise = null;
      resolve(ad);
    };
    const onError = (error) => {
      setState("error");
      activeAd = null;
      loadPromise = null;
      reject(error ?? new Error("AD_LOAD_FAILED"));
    };

    attachListener(ad, RewardedAdEventType.LOADED, onLoaded);
    attachListener(ad, RewardedAdEventType.ERROR, onError);
    ad.load();
  });

  return loadPromise;
}

export async function showRewardedAd({ onEarned, onClosed: onClosedCb } = {}) {
  if (!activeAd) {
    setState("unavailable");
    throw new Error("AD_NOT_READY");
  }
  if (showing) {
    throw new Error("AD_SHOW_IN_PROGRESS");
  }
  showing = true;
  setState("show");

  return new Promise((resolve, reject) => {
    let rewarded = false;

    const onEarnedReward = () => {
      rewarded = true;
      setState("earned");
      onEarned?.();
    };

    const handleClosed = () => {
      showing = false;
      detachAdListeners(activeAd);
      activeAd = null;
      if (!rewarded) {
        setState("closed_early");
        onClosedCb?.({ rewarded: false });
        resolve({ rewarded: false, sessionId: activeSessionId });
        return;
      }
      onClosedCb?.({ rewarded: true });
      resolve({ rewarded: true, sessionId: activeSessionId });
    };

    attachListener(activeAd, RewardedAdEventType.EARNED_REWARD, onEarnedReward);
    attachListener(activeAd, RewardedAdEventType.CLOSED, handleClosed);

    activeAd
      .show()
      .catch((error) => {
        showing = false;
        setState("error");
        reject(error);
      });
  });
}

export function markRewardedAdConfirmed() {
  setState("confirmed");
}
