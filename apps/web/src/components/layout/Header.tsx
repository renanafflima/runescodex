import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { assetUrl } from "../../lib/assets";
import { initialsFrom } from "../../domain/format";
import { ButtonLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { Navigation } from "./Navigation";
import { PageContainer } from "./PageContainer";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function Header() {
  const { isAuthenticated, user, activeCharacter } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <header className="site-header">
      <PageContainer className="site-header__inner" size="wide">
        <Link className="brand" to="/" aria-label="RuneCodex — início">
          <img
            alt=""
            className="brand__mark"
            height="44"
            src={assetUrl("images/brand/runescodex-icon.png")}
            width="44"
          />
          <span className="brand__copy">
            <strong>RuneCodex</strong>
            <small>Explore · Cace · Evolua</small>
          </span>
        </Link>

        <Navigation onNavigate={() => setMenuOpen(false)} open={menuOpen} />

        <div className="site-header__actions">
          {installPrompt ? (
            <button className="install-action" onClick={installApp} type="button">
              <Icon name="download" size={17} />
              <span>Instalar</span>
            </button>
          ) : null}
          {isAuthenticated ? (
            <ButtonLink
              className="site-header__account"
              size="sm"
              to="/profile"
              variant="secondary"
            >
              <span className="site-header__avatar" aria-hidden="true">
                {initialsFrom(activeCharacter?.name || user?.email || "R")}
              </span>
              <span>{activeCharacter?.name || "Perfil"}</span>
            </ButtonLink>
          ) : (
            <ButtonLink
              className="site-header__login"
              size="sm"
              to="/login"
              variant="secondary"
            >
              Entrar
            </ButtonLink>
          )}
          <IconButton
            aria-controls="primary-navigation"
            aria-expanded={menuOpen}
            className="site-header__menu"
            label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((current) => !current)}
            variant="ghost"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </IconButton>
        </div>
      </PageContainer>
      {menuOpen ? (
        <button
          aria-hidden="true"
          className="site-header__scrim"
          onClick={() => setMenuOpen(false)}
          tabIndex={-1}
          type="button"
        />
      ) : null}
    </header>
  );
}
