const ACCESS_TOKEN_KEY = "runecodex.accessToken";

type SessionListener = (token: string) => void;

const listeners = new Set<SessionListener>();

function storage() {
  return window.sessionStorage;
}

function notify(token: string) {
  listeners.forEach((listener) => listener(token));
}

export function getAccessToken() {
  try {
    return storage().getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAccessToken(token: string) {
  try {
    if (token) storage().setItem(ACCESS_TOKEN_KEY, token);
    else storage().removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Private mode or blocked storage should not crash the app.
  }
  notify(token);
}

export function clearAccessToken() {
  setAccessToken("");
}

export function subscribeAccessToken(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
