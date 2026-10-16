const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

type GoogleCredentialCallback = {
  credential?: string;
};

type GoogleButtonSize = "small" | "medium" | "large";

type GoogleButtonText = "continue_with" | "signin_with" | "signup_with" | "signin";

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialCallback) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: GoogleButtonSize;
      text: GoogleButtonText;
      shape: "rectangular";
      logo_alignment: "left";
      width: number;
      locale: string;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let mountGeneration = 0;

export function googleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("unavailable"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export type GoogleSignInMount = {
  cancel: () => void;
};

type MountGoogleSignInOptions = {
  fullWidth?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
  onFailure?: (error: Error) => void;
  size?: GoogleButtonSize;
  text?: GoogleButtonText;
};

function buttonWidth(parent: HTMLElement, fullWidth: boolean) {
  if (!fullWidth) return 240;
  const measured = Math.round(parent.getBoundingClientRect().width);
  return Math.min(400, Math.max(240, measured || 320));
}

// One Tap (`prompt`) is aborted by FedCM when a custom button opens it.
// The Sign in with Google button returns the same ID token from the click itself.
export function mountGoogleSignInButton(
  parent: HTMLElement,
  options: MountGoogleSignInOptions,
): GoogleSignInMount {
  const generation = ++mountGeneration;
  let disposed = false;
  let busy = false;

  void loadGoogleScript()
    .then(() => {
      if (disposed || generation !== mountGeneration) return;
      const clientId = googleClientId();
      const googleId = window.google?.accounts?.id;
      if (!clientId || !googleId) {
        options.onFailure?.(new Error(clientId ? "unavailable" : "not-configured"));
        return;
      }

      googleId.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_button: false,
        callback: (response) => {
          const credential = response.credential;
          if (disposed || generation !== mountGeneration || busy || !credential) return;
          busy = true;
          void Promise.resolve(options.onCredential(credential)).finally(() => {
            busy = false;
          });
        },
      });

      parent.replaceChildren();
      googleId.renderButton(parent, {
        type: "standard",
        theme: "outline",
        size: options.size ?? "large",
        text: options.text ?? "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: buttonWidth(parent, options.fullWidth ?? true),
        locale: "pt-BR",
      });
    })
    .catch((error: unknown) => {
      if (disposed || generation !== mountGeneration) return;
      options.onFailure?.(error instanceof Error ? error : new Error("unavailable"));
    });

  return {
    cancel() {
      disposed = true;
      if (generation === mountGeneration) mountGeneration += 1;
      parent.replaceChildren();
    },
  };
}
