import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ptBR from "./locales/pt-BR";
import en from "./locales/en";
import es from "./locales/es";
import pl from "./locales/pl";

const STORAGE_KEY = "@runescodex:locale";

export const LOCALES = [
  { id: "pt-BR", label: "Português" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "pl", label: "Polski" },
];

const DICTS = {
  "pt-BR": ptBR,
  en,
  es,
  pl,
};

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key])
  );
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState("pt-BR");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved && DICTS[saved]) setLocaleState(saved);
      setReady(true);
    })();
  }, []);

  async function setLocale(next) {
    if (!DICTS[next]) return;
    setLocaleState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const value = useMemo(() => {
    const dict = DICTS[locale] || ptBR;
    function t(key, vars) {
      const raw = get(dict, key) ?? get(ptBR, key) ?? key;
      return interpolate(raw, vars);
    }
    return { locale, setLocale, t, locales: LOCALES, ready };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
