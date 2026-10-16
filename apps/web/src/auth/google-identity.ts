const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

type GoogleCredentialCallback = {
  credential?: string;
};

type PromptMoment = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialCallback) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  prompt: (listener: (moment: PromptMoment) => void) => void;
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

export function requestGoogleCredential() {
  const clientId = googleClientId();
  if (!clientId) return Promise.reject(new Error("not-configured"));

  return loadGoogleScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const googleId = window.google?.accounts?.id;
        if (!googleId) {
          reject(new Error("unavailable"));
          return;
        }
        let settled = false;
        const finish = (error?: Error, credential?: string) => {
          if (settled) return;
          settled = true;
          if (credential) resolve(credential);
          else reject(error ?? new Error("cancelled"));
        };
        googleId.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            if (response.credential) finish(undefined, response.credential);
            else finish(new Error("unavailable"));
          },
        });
        googleId.prompt((moment) => {
          if (moment.isNotDisplayed() || moment.isSkippedMoment()) {
            finish(new Error("unavailable"));
            return;
          }
          if (
            moment.isDismissedMoment() &&
            moment.getDismissedReason() !== "credential_returned"
          ) {
            finish(new Error("cancelled"));
          }
        });
      }),
  );
}
