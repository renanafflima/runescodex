import { InstallAppButton } from "../pwa/InstallAppButton";
import { usePwaInstall } from "../../hooks/usePwaInstall";

export function HomeInstallCta() {
  const { status } = usePwaInstall();

  if (status === "installed" || status === "unsupported") return null;

  return (
    <div className="home-portal-install">
      <p className="home-portal-install__lead">
        {status === "ios"
          ? "Instale o RuneCodex na tela inicial pelo Safari."
          : "Instale o RuneCodex e continue sua jornada como um aplicativo."}
      </p>
      <InstallAppButton label="Instalar o RuneCodex" size="lg" variant="home" />
    </div>
  );
}
