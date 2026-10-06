import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { PageContainer } from "../components/layout/PageContainer";

export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0 });
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <Header />
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <PageContainer className="site-footer__inner" size="wide">
          <span>RuneCodex</span>
          <span>Mais que caçar, é evoluir.</span>
        </PageContainer>
      </footer>
    </div>
  );
}
