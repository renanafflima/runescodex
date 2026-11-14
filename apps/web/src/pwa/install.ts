export type PwaInstallStatus = "available" | "ios" | "installed" | "unsupported";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallListener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let started = false;
let prompting = false;
let cleanup: (() => void) | null = null;
const listeners = new Set<InstallListener>();

export function isStandaloneDisplay(
  win: Pick<Window, "matchMedia"> & { navigator: Navigator } = window,
) {
  const media = win.matchMedia?.("(display-mode: standalone)");
  if (media?.matches) return true;
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function isIosDevice(
  nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> = navigator,
) {
  const ua = nav.userAgent || "";
  const platform = nav.platform || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return platform === "MacIntel" && nav.maxTouchPoints > 1;
}

export function isIosSafari(
  nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> = navigator,
) {
  if (!isIosDevice(nav)) return false;
  const ua = nav.userAgent || "";
  const isSafariToken = /Safari/i.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
  return isSafariToken && !isOtherBrowser;
}

export function getPwaInstallStatus(
  win: Pick<Window, "matchMedia"> & { navigator: Navigator } = window,
): PwaInstallStatus {
  if (typeof window === "undefined") return "unsupported";
  if (isStandaloneDisplay(win)) return "installed";
  if (deferredPrompt) return "available";
  if (isIosDevice(win.navigator)) return "ios";
  return "unsupported";
}

export function canPromptInstall() {
  return getPwaInstallStatus() === "available";
}

export function shouldShowInstallAction() {
  const status = getPwaInstallStatus();
  return status === "available" || status === "ios";
}

function notify() {
  for (const listener of listeners) listener();
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
}

function onAppInstalled() {
  deferredPrompt = null;
  notify();
}

function onDisplayModeChange() {
  notify();
}

export function startPwaInstallService(win: Window = window) {
  if (started) return;
  started = true;
  win.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  win.addEventListener("appinstalled", onAppInstalled);
  const media = win.matchMedia?.("(display-mode: standalone)");
  media?.addEventListener?.("change", onDisplayModeChange);
  cleanup = () => {
    win.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    win.removeEventListener("appinstalled", onAppInstalled);
    media?.removeEventListener?.("change", onDisplayModeChange);
  };
}

export async function promptPwaInstall() {
  if (!deferredPrompt || prompting) return { outcome: "unavailable" as const };
  const promptEvent = deferredPrompt;
  prompting = true;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredPrompt = null;
    notify();
    return choice;
  } finally {
    prompting = false;
  }
}

export function subscribePwaInstall(listener: InstallListener) {
  startPwaInstallService();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaInstallSnapshot() {
  return getPwaInstallStatus();
}

export function resetPwaInstallService() {
  cleanup?.();
  cleanup = null;
  started = false;
  prompting = false;
  deferredPrompt = null;
  listeners.clear();
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function isPwaPromptInFlight() {
  return prompting;
}

if (typeof window !== "undefined") {
  startPwaInstallService();
}
