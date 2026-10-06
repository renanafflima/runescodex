import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PageContainer } from "../layout/PageContainer";
import { Loading } from "../ui/Feedback";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <PageContainer className="session-loading" size="narrow">
        <Loading label="Verificando sessão" size="lg" />
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return children;
}
