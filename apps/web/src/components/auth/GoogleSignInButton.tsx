import { useEffect, useRef, useState } from "react";
import { googleClientId, mountGoogleSignInButton } from "../../auth/google-identity";
import { describeGoogleError } from "../../auth/google-errors";
import { Button } from "../ui/Button";

type GoogleSignInButtonProps = {
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
  onCredential: (credential: string) => Promise<void>;
  onError?: (message: string) => void;
  showUnavailable?: boolean;
  size?: "sm" | "md" | "lg";
};

const BUTTON_SIZE = {
  sm: "small",
  md: "medium",
  lg: "large",
} as const;

export function GoogleSignInButton({
  disabled = false,
  fullWidth = true,
  label = "Continuar com Google",
  onCredential,
  onError,
  showUnavailable = true,
  size = "lg",
}: GoogleSignInButtonProps) {
  const clientId = googleClientId();
  const hostRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent || !clientId) return;
    let alive = true;
    const handle = mountGoogleSignInButton(parent, {
      fullWidth,
      size: BUTTON_SIZE[size],
      text: "continue_with",
      onFailure: () => {
        if (alive) setFailed(true);
      },
      onCredential: async (credential) => {
        if (alive) setPending(true);
        try {
          await onCredentialRef.current(credential);
        } catch (error: unknown) {
          if (!alive) return;
          const message = describeGoogleError(error);
          if (message) onErrorRef.current?.(message);
        } finally {
          if (alive) setPending(false);
        }
      },
    });

    return () => {
      alive = false;
      handle.cancel();
    };
  }, [clientId, fullWidth, size]);

  if (!clientId || failed) {
    if (!showUnavailable) return null;
    return (
      <>
        <Button className="google-button" disabled fullWidth={fullWidth} size={size} variant="secondary">
          {label}
        </Button>
        <p className="auth-panel__footnote">
          {clientId
            ? "O login com Google não carregou. Tente novamente."
            : "O login com Google não está configurado neste ambiente."}
        </p>
      </>
    );
  }

  return (
    <div
      aria-busy={pending}
      className={[
        "google-sign-in",
        fullWidth ? "google-sign-in--full" : "",
        disabled || pending ? "google-sign-in--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={hostRef}
    />
  );
}
