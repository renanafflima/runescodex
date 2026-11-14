import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPwaInstallStatus,
  isIosDevice,
  isIosSafari,
  isPwaPromptInFlight,
  isStandaloneDisplay,
  promptPwaInstall,
  resetPwaInstallService,
  startPwaInstallService,
  subscribePwaInstall,
  type BeforeInstallPromptEvent,
} from "./install";

function stubNavigator(partial: Partial<Navigator> & { standalone?: boolean }) {
  vi.stubGlobal("navigator", {
    ...window.navigator,
    userAgent: "Mozilla/5.0",
    platform: "Win32",
    maxTouchPoints: 0,
    ...partial,
  });
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("standalone") ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function installPromptEvent() {
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  Object.defineProperty(event, "preventDefault", {
    value: vi.fn(),
  });
  return event;
}

afterEach(() => {
  resetPwaInstallService();
  vi.unstubAllGlobals();
});

describe("PWA install detection", () => {
  it("treats display-mode standalone as installed", () => {
    stubMatchMedia(true);
    stubNavigator({});
    expect(isStandaloneDisplay()).toBe(true);
    expect(getPwaInstallStatus()).toBe("installed");
  });

  it("treats iOS navigator.standalone as installed", () => {
    stubMatchMedia(false);
    stubNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      standalone: true,
    });
    expect(getPwaInstallStatus()).toBe("installed");
  });

  it("detects iOS Safari that is not installed", () => {
    stubMatchMedia(false);
    stubNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    });
    expect(isIosDevice()).toBe(true);
    expect(isIosSafari()).toBe(true);
    expect(getPwaInstallStatus()).toBe("ios");
  });

  it("detects iPad on iOS 13+ desktop UA", () => {
    stubNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });
    expect(isIosDevice()).toBe(true);
  });

  it("marks browsers without a native prompt as unsupported", () => {
    stubMatchMedia(false);
    stubNavigator({ userAgent: "Mozilla/5.0 Firefox/131.0", platform: "Win32" });
    expect(getPwaInstallStatus()).toBe("unsupported");
  });
});

describe("PWA install prompt lifecycle", () => {
  it("captures a single beforeinstallprompt and prompts only on demand", async () => {
    stubMatchMedia(false);
    stubNavigator({});
    startPwaInstallService();
    startPwaInstallService();

    const sync = vi.fn();
    const unsubscribe = subscribePwaInstall(sync);
    const event = installPromptEvent();
    window.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(getPwaInstallStatus()).toBe("available");
    expect(sync).toHaveBeenCalled();

    await promptPwaInstall();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(getPwaInstallStatus()).toBe("unsupported");

    unsubscribe();
  });

  it("hides the prompt after appinstalled", () => {
    stubMatchMedia(false);
    stubNavigator({});
    startPwaInstallService();
    window.dispatchEvent(installPromptEvent());
    expect(getPwaInstallStatus()).toBe("available");

    window.dispatchEvent(new Event("appinstalled"));
    expect(getPwaInstallStatus()).toBe("unsupported");
  });

  it("registers window listeners only once across service starts", () => {
    stubMatchMedia(false);
    stubNavigator({});
    resetPwaInstallService();
    const addListener = vi.spyOn(window, "addEventListener");

    startPwaInstallService();
    startPwaInstallService();
    subscribePwaInstall(() => undefined);

  const beforeCount = addListener.mock.calls.filter(([type]) => type === "beforeinstallprompt")
    .length;
    const installedCount = addListener.mock.calls.filter(([type]) => type === "appinstalled").length;

    expect(beforeCount).toBe(1);
    expect(installedCount).toBe(1);
    addListener.mockRestore();
  });

  it("notifies every subscriber when beforeinstallprompt arrives late", () => {
    stubMatchMedia(false);
    stubNavigator({});
    resetPwaInstallService();
    startPwaInstallService();

    const first = vi.fn();
    const second = vi.fn();
    subscribePwaInstall(first);
    subscribePwaInstall(second);
    first.mockClear();
    second.mockClear();

    window.dispatchEvent(installPromptEvent());

    expect(getPwaInstallStatus()).toBe("available");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("notifies every subscriber after appinstalled", () => {
    stubMatchMedia(false);
    stubNavigator({});
    resetPwaInstallService();
    startPwaInstallService();
    window.dispatchEvent(installPromptEvent());

    const first = vi.fn();
    const second = vi.fn();
    subscribePwaInstall(first);
    subscribePwaInstall(second);
    first.mockClear();
    second.mockClear();

    window.dispatchEvent(new Event("appinstalled"));

    expect(getPwaInstallStatus()).toBe("unsupported");
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("allows only one native prompt while a prompt is in flight", async () => {
    stubMatchMedia(false);
    stubNavigator({});
    resetPwaInstallService();
    startPwaInstallService();

    const event = installPromptEvent();
    let resolveChoice: (value: { outcome: "accepted" }) => void = () => undefined;
    event.userChoice = new Promise((resolve) => {
      resolveChoice = resolve;
    });
    window.dispatchEvent(event);

    const firstCall = promptPwaInstall();
    const secondCall = promptPwaInstall();

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(isPwaPromptInFlight()).toBe(true);

    resolveChoice({ outcome: "accepted" });
    await firstCall;
    await secondCall;
    expect(isPwaPromptInFlight()).toBe(false);
  });
});
