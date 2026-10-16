import { useState } from "react";
import { googleClientId, requestGoogleCredential } from "../../auth/google-identity";
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
  const [pending, setPending] = useState(false);

  if (!clientId) {
    if (!showUnavailable) return null;
    return (
      <>
        <Button className="google-button" disabled fullWidth={fullWidth} size={size} variant="secondary">
          {label}
        </Button>
        <p className="auth-panel__footnote">
          O login com Google não está configurado neste ambiente.
        </p>
      </>
    );
  }

  return (
    <Button
      className="google-button"
      disabled={disabled || pending}
      fullWidth={fullWidth}
      loading={pending}
      onClick={() => {
        setPending(true);
        void requestGoogleCredential()
          .then((credential) => onCredential(credential))
          .catch((error: unknown) => {
            const message = describeGoogleError(error);
            if (message) onError?.(message);
          })
          .finally(() => setPending(false));
      }}
      size={size}
      type="button"
      variant="secondary"
    >
      {label}
    </Button>
  );
}
