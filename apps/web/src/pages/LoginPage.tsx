import { Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Toast } from "../components/ui/Toast";
import { DEVICE_LIMIT_MESSAGE } from "../services/api/errors";

export function LoginPage() {
  const { isAuthenticated, loginWithGoogle, status, user } = useAuth();
  const location = useLocation();
  const from =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/profile";

  const [limited, setLimited] = useState(false);
  const [explainLimit, setExplainLimit] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  if (status !== "loading" && isAuthenticated) {
    const safeFrom =
      from.startsWith("/") && !from.startsWith("//") && from !== "/login" ? from : "/profile";
    return <Navigate replace to={user?.premium?.access ? safeFrom : "/checkout"} />;
  }

  return (
    <div className="auth-page">
      <PageContainer className="auth-page__inner" size="wide">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <div>
            <span className="eyebrow">RuneCodex</span>
            <h1 id="auth-story-title">
              Sua jornada,
              <span> sempre com você.</span>
            </h1>
            <p>
              Use a mesma conta do aplicativo para acompanhar personagens e
              progresso.
            </p>
          </div>
          <blockquote>“Mais que caçar, é evoluir.”</blockquote>
        </section>

        <section className="auth-panel" aria-labelledby="login-title">
          {limited ? (
            <div className="device-limit">
              <Badge tone="gold">Equipamentos</Badge>
              <h2 id="login-title">Limite de equipamentos atingido</h2>
              <p>{DEVICE_LIMIT_MESSAGE}</p>
              {explainLimit ? (
                <p>
                  Cada conta fica vinculada a no máximo dois equipamentos. Entrar outra vez no mesmo navegador não ocupa
                  uma vaga nova. Limpar os dados do navegador ou trocar de navegador cria um equipamento novo. Para
                  liberar uma vaga, entre em um equipamento já autorizado e remova o outro em Meus equipamentos. Este
                  aparelho não pode ver nem remover os vínculos sem uma sessão autorizada.
                </p>
              ) : null}
              <div className="device-limit__actions">
                <Button
                  onClick={() => {
                    setLimited(false);
                    setExplainLimit(false);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Voltar ao login
                </Button>
                <Button onClick={() => setExplainLimit((current) => !current)} type="button">
                  Entender como funciona
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="auth-panel__heading">
                <Badge tone="gold">Acesso RuneCodex</Badge>
                <h2 id="login-title">Sua jornada começa com o Google.</h2>
              </div>

              <div className="auth-panel__google-notice" role="note">
                <p>
                  Utilize sua conta Google para acessar o RuneCodex de forma simples e rápida. Assim, você entra na
                  aventura sem complicação!
                </p>
              </div>

              <GoogleSignInButton
                onCredential={loginWithGoogle}
                onError={(message) => {
                  if (message === DEVICE_LIMIT_MESSAGE) {
                    setLimited(true);
                    return;
                  }
                  setNotice({
                    title: "Não foi possível entrar com o Google",
                    message,
                    tone: "error",
                  });
                }}
              />
            </>
          )}
        </section>
      </PageContainer>

      {notice ? (
        <div className="toast-region">
          <Toast
            message={notice.message}
            onClose={() => setNotice(null)}
            title={notice.title}
            tone={notice.tone}
          />
        </div>
      ) : null}
    </div>
  );
}