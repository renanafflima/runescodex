import { useCallback, useSyncExternalStore } from "react";
import {
  getPwaInstallSnapshot,
  promptPwaInstall,
  subscribePwaInstall,
  type PwaInstallStatus,
} from "../pwa/install";

function getServerSnapshot(): PwaInstallStatus {
  return "unsupported";
}

export function usePwaInstall() {
  const status = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getServerSnapshot,
  );

  const promptInstall = useCallback(() => promptPwaInstall(), []);

  return {
    status,
    canPrompt: status === "available",
    showAction: status === "available" || status === "ios",
    promptInstall,
  };
}