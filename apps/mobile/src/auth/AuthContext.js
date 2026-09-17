import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, loginUser, registerUser } from "@/src/api/auth";
import {
  createCharacter,
  deleteCharacter,
  getActiveCharacter,
  getCharacter,
  listCharacters,
  setActiveCharacter,
  updateCharacter,
} from "@/src/api/characters";
import { STORAGE_KEYS } from "@/src/api/config";

/**
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {string} vocation
 * @property {number} level
 * @property {string} world
 *
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 *
 * @typedef {Object} AuthContextValue
 * @property {boolean} isReady
 * @property {boolean} isAuthenticated
 * @property {AuthUser | null} user
 * @property {Character[]} characters
 * @property {Character | null} activeCharacter
 * @property {(email: string, password: string) => Promise<void>} login
 * @property {(email: string, password: string) => Promise<void>} register
 * @property {() => Promise<void>} logout
 * @property {() => Promise<void>} refreshMe
 * @property {(payload: object) => Promise<Character>} createCharacter
 * @property {(id: string, payload: object) => Promise<Character>} updateCharacter
 * @property {(id: string) => Promise<void>} deleteCharacter
 * @property {(id: string) => Promise<void>} setActiveCharacter
 * @property {(id: string) => Promise<Character>} fetchCharacter
 * @property {() => Promise<void>} reloadCharacters
 */

const AuthContext = createContext(/** @type {AuthContextValue | null} */ (null));

function sessionFromAuthResponse(data) {
  return {
    token: data?.accessToken || "",
    user: data?.user || null,
  };
}

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [activeCharacter, setActive] = useState(null);

  const persistToken = useCallback(async (nextToken) => {
    if (nextToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.accessToken, nextToken);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.accessToken);
    }
  }, []);

  const clearSession = useCallback(async () => {
    setToken("");
    setUser(null);
    setCharacters([]);
    setActive(null);
    await persistToken("");
  }, [persistToken]);

  const loadCharacters = useCallback(async (authToken) => {
    const [list, active] = await Promise.all([
      listCharacters(authToken),
      getActiveCharacter(authToken),
    ]);
    setCharacters(Array.isArray(list) ? list : []);
    setActive(active || null);
  }, []);

  const applySession = useCallback(
    async (nextToken, nextUser) => {
      setToken(nextToken);
      setUser(nextUser);
      await persistToken(nextToken);
      try {
        await loadCharacters(nextToken);
      } catch {
        setCharacters([]);
        setActive(null);
      }
    },
    [loadCharacters, persistToken]
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
        if (!saved) {
          setIsReady(true);
          return;
        }
        const me = await fetchMe(saved);
        setToken(saved);
        setUser(me);
        try {
          await loadCharacters(saved);
        } catch {
          setCharacters([]);
          setActive(null);
        }
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEYS.accessToken);
        setToken("");
        setUser(null);
        setCharacters([]);
        setActive(null);
      } finally {
        setIsReady(true);
      }
    })();
  }, [loadCharacters]);

  const login = useCallback(
    async (email, password) => {
      const data = await loginUser(email, password);
      const session = sessionFromAuthResponse(data);
      if (!session.token || !session.user) {
        throw new Error("HTTP_ERROR");
      }
      await applySession(session.token, session.user);
    },
    [applySession]
  );

  const register = useCallback(
    async (email, password) => {
      const data = await registerUser(email, password);
      const session = sessionFromAuthResponse(data);
      if (!session.token || !session.user) {
        throw new Error("HTTP_ERROR");
      }
      await applySession(session.token, session.user);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const me = await fetchMe(token);
      setUser(me);
    } catch (error) {
      if (error?.status === 401) await clearSession();
      throw error;
    }
  }, [clearSession, token]);

  const create = useCallback(
    async (payload) => {
      try {
        const created = await createCharacter(token, payload);
        await loadCharacters(token);
        return created;
      } catch (error) {
        if (error?.status === 401) await clearSession();
        throw error;
      }
    },
    [clearSession, loadCharacters, token]
  );

  const update = useCallback(
    async (id, payload) => {
      try {
        const updated = await updateCharacter(token, id, payload);
        await loadCharacters(token);
        return updated;
      } catch (error) {
        if (error?.status === 401) await clearSession();
        throw error;
      }
    },
    [clearSession, loadCharacters, token]
  );

  const remove = useCallback(
    async (id) => {
      try {
        await deleteCharacter(token, id);
        await loadCharacters(token);
      } catch (error) {
        if (error?.status === 401) await clearSession();
        throw error;
      }
    },
    [clearSession, loadCharacters, token]
  );

  const activate = useCallback(
    async (id) => {
      try {
        const next = await setActiveCharacter(token, id);
        setActive(next);
      } catch (error) {
        if (error?.status === 401) await clearSession();
        throw error;
      }
    },
    [clearSession, token]
  );

  const fetchCharacter = useCallback(
    async (id) => {
      try {
        return await getCharacter(token, id);
      } catch (error) {
        if (error?.status === 401) await clearSession();
        throw error;
      }
    },
    [clearSession, token]
  );

  const value = useMemo(
    () => ({
      isReady,
      isAuthenticated: Boolean(token && user),
      user,
      characters,
      activeCharacter,
      login,
      register,
      logout,
      refreshMe,
      createCharacter: create,
      updateCharacter: update,
      deleteCharacter: remove,
      setActiveCharacter: activate,
      fetchCharacter,
      reloadCharacters: () => (token ? loadCharacters(token) : Promise.resolve()),
    }),
    [
      activate,
      activeCharacter,
      characters,
      create,
      fetchCharacter,
      loadCharacters,
      login,
      logout,
      refreshMe,
      register,
      remove,
      token,
      update,
      user,
      isReady,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {AuthContextValue} */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
