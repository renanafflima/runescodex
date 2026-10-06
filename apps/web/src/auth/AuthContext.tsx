import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../services/api/errors";
import { fetchMe, loginUser, logoutUser, registerUser } from "../services/api/auth";
import {
  createCharacter as createCharacterRequest,
  deleteCharacter as deleteCharacterRequest,
  getActiveCharacter,
  listCharacters,
  setActiveCharacter as setActiveCharacterRequest,
  updateCharacter as updateCharacterRequest,
  type CharacterPayload,
} from "../services/api/characters";
import type { AuthUser, Character } from "../services/api/types";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from "../services/session";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  isReady: boolean;
  isRosterReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  characters: Character[];
  activeCharacter: Character | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createCharacter: (payload: CharacterPayload) => Promise<Character>;
  updateCharacter: (id: string, payload: Partial<CharacterPayload>) => Promise<Character>;
  deleteCharacter: (id: string) => Promise<void>;
  setActiveCharacter: (id: string) => Promise<void>;
  reloadCharacters: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionFromAuthResponse(data: { user?: AuthUser; accessToken?: string }) {
  return {
    token: data.accessToken || "",
    user: data.user || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacter, setActive] = useState<Character | null>(null);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const characterLoads = useRef(0);

  const resetLocalSession = useCallback(() => {
    setUser(null);
    setCharacters([]);
    setActive(null);
    setRosterLoaded(true);
    setStatus("anonymous");
  }, []);

  const loadCharacters = useCallback(async () => {
    const requestId = ++characterLoads.current;
    const [list, active] = await Promise.all([listCharacters(), getActiveCharacter()]);
    if (requestId !== characterLoads.current) return;
    setCharacters(Array.isArray(list) ? list : []);
    setActive(active || null);
  }, []);

  const applySession = useCallback(
    async (token: string, nextUser: AuthUser) => {
      setAccessToken(token);
      setUser(nextUser);
      setStatus("authenticated");
      setRosterLoaded(false);
      try {
        await loadCharacters();
      } catch (error) {
        setCharacters([]);
        setActive(null);
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken();
          resetLocalSession();
          return;
        }
      } finally {
        setRosterLoaded(true);
      }
    },
    [loadCharacters, resetLocalSession],
  );

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const saved = getAccessToken();
      if (!saved) {
        if (!cancelled) {
          setRosterLoaded(true);
          setStatus("anonymous");
        }
        return;
      }

      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
        try {
          await loadCharacters();
        } catch {
          if (!cancelled) {
            setCharacters([]);
            setActive(null);
          }
        }
        if (!cancelled) setRosterLoaded(true);
      } catch {
        clearAccessToken();
        if (!cancelled) resetLocalSession();
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [loadCharacters, resetLocalSession]);

  useEffect(() => {
    return subscribeAccessToken((token) => {
      if (!token) resetLocalSession();
    });
  }, [resetLocalSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginUser(email, password);
      const session = sessionFromAuthResponse(data);
      if (!session.token || !session.user) {
        throw new ApiError("HTTP_ERROR", 0, "Resposta de autenticação inválida.", data);
      }
      await applySession(session.token, session.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const data = await registerUser(email, password);
      const session = sessionFromAuthResponse(data);
      if (!session.token || !session.user) {
        throw new ApiError("HTTP_ERROR", 0, "Resposta de autenticação inválida.", data);
      }
      await applySession(session.token, session.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await logoutUser();
    } catch {
      // Local session is cleared even when the server is unreachable.
    }
    clearAccessToken();
    resetLocalSession();
  }, [resetLocalSession]);

  const create = useCallback(
    async (payload: CharacterPayload) => {
      const created = await createCharacterRequest(payload);
      await loadCharacters();
      return created;
    },
    [loadCharacters],
  );

  const update = useCallback(
    async (id: string, payload: Partial<CharacterPayload>) => {
      const updated = await updateCharacterRequest(id, payload);
      await loadCharacters();
      return updated;
    },
    [loadCharacters],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCharacterRequest(id);
      await loadCharacters();
    },
    [loadCharacters],
  );

  const activate = useCallback(async (id: string) => {
    const next = await setActiveCharacterRequest(id);
    setActive(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isReady: status !== "loading",
      isRosterReady: status === "anonymous" || (status === "authenticated" && rosterLoaded),
      isAuthenticated: status === "authenticated" && Boolean(user),
      user,
      characters,
      activeCharacter,
      login,
      register,
      logout,
      createCharacter: create,
      updateCharacter: update,
      deleteCharacter: remove,
      setActiveCharacter: activate,
      reloadCharacters: loadCharacters,
    }),
    [
      activate,
      activeCharacter,
      characters,
      create,
      loadCharacters,
      login,
      logout,
      register,
      remove,
      rosterLoaded,
      status,
      update,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
