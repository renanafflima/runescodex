import { useRef, useState } from "react";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { IosInstallHint } from "./IosInstallHint";

type InstallAppButtonProps = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "header" | "nav" | "home";
};

export function InstallAppButton({
  className = "",
  label = "Instalar o RuneCodex",
  size = "md",
  variant = "home",
}: InstallAppButtonProps) {
  const { status, promptInstall } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const nativeOnly = variant === "header";
  const visible =
    status === "available" || (!nativeOnly && status === "ios");

  if (!visible) return null;

  async function onInstall() {
    if (status === "ios") {
      setIosOpen(true);
      return;
    }
    await promptInstall();
  }

  if (variant === "header") {
    return (
      <button
        className={`install-action ${className}`.trim()}
        onClick={() => void onInstall()}
        ref={triggerRef}
        type="button"
      >
        <Icon name="download" size={17} />
        <span>Instalar</span>
      </button>
    );
  }

  if (variant === "nav") {
    return (
      <>
        <button
          className={`navigation__link navigation__install ${className}`.trim()}
          onClick={() => void onInstall()}
          ref={triggerRef}
          type="button"
        >
          <Icon name="download" size={17} />
          <span>Instalar app</span>
        </button>
        <IosInstallHint
          onClose={() => setIosOpen(false)}
          open={iosOpen}
          returnFocusRef={triggerRef}
        />
      </>
    );
  }

  return (
    <>
      <Button
        className={className}
        leadingIcon={<Icon name="download" size={18} />}
        onClick={() => void onInstall()}
        ref={triggerRef}
        size={size}
        type="button"
      >
        {label}
      </Button>
      <IosInstallHint
        onClose={() => setIosOpen(false)}
        open={iosOpen}
        returnFocusRef={triggerRef}
      />
    </>
  );
}