import { Navigate, useLocation } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormControls";
import { Toast } from "../components/ui/Toast";
import { describeApiError } from "../services/api/errors";

type AuthMode = "login" | "register";

export function LoginPage() {
  const { isAuthenticated, login, register, status } = useAuth();
  const location = useLocation();
  const from =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/profile";

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    title: string;
    tone: "info" | "success" | "error";
  } | null>(null);

  if (status !== "loading" && isAuthenticated) {
    return <Navigate replace to={from || "/profile"} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!email.trim() || !password || (mode === "register" && password.length < 8)) {
      setFieldError(true);
      setNotice({
        title: "Preencha seus dados",
        message:
          mode === "register"
            ? "Informe um email válido e uma senha com pelo menos 8 caracteres."
            : "Informe email e senha para continuar.",
        tone: "error",
      });
      return;
    }

    setFieldError(false);
    setSubmitting(true);
    try {
      if (mode === "register") await register(email.trim(), password);
      else await login(email.trim(), password);
    } catch (error) {
      setNotice({
        title: mode === "register" ? "Não foi possível criar a conta" : "Não foi possível entrar",
        message: describeApiError(error),
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
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
          <div className="auth-panel__heading">
            <Badge tone="gold">Acesso RuneCodex</Badge>
            <h2 id="login-title">
              {mode === "register" ? "Criar sua conta" : "Entrar na sua conta"}
            </h2>
            <p>A autenticação usa a mesma API do aplicativo.</p>
          </div>

          <Button
            className="google-button"
            disabled
            fullWidth
            size="lg"
            variant="secondary"
          >
            Continuar com Google
          </Button>
          <p className="auth-panel__footnote">
            O login com Google ainda não está disponível nesta API.
          </p>

          <div className="auth-divider">
            <span>ou acesse com email</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <Input
              autoComplete="email"
              error={fieldError && !email.trim() ? "Informe seu email." : undefined}
              label="Email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              type="email"
              value={email}
            />
            <Input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              error={
                fieldError && (!password || (mode === "register" && password.length < 8))
                  ? mode === "register"
                    ? "A senha precisa ter pelo menos 8 caracteres."
                    : "Informe sua senha."
                  : undefined
              }
              label="Senha"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              type="password"
              value={password}
            />
            <Button fullWidth loading={submitting} size="lg" type="submit">
              {submitting
                ? mode === "register"
                  ? "Criando conta..."
                  : "Entrando..."
                : mode === "register"
                  ? "Criar conta"
                  : "Entrar"}
            </Button>
          </form>

          <p className="auth-panel__footnote">
            {mode === "register" ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button
              className="text-link"
              onClick={() => {
                setMode((current) => (current === "login" ? "register" : "login"));
                setNotice(null);
                setFieldError(false);
              }}
              type="button"
            >
              {mode === "register" ? "Entrar" : "Criar conta"}
            </button>
          </p>
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
