import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const STORAGE_KEYS = {
  userId: "@runescodex:userId",
  points: "@runescodex:points",
  quests: "@runescodex:quests",
  forumThreads: "@runescodex:forumThreads",
  redemptions: "@runescodex:redemptions",
  sessions: "@runescodex:sessions",
};

const DEFAULT_SESSIONS = [
  {
    id: "l1",
    type: "boss",
    huntName: "Ferumbras",
    vocation: "",
    level: null,
    xp: 0,
    profit: 2500000,
    durationMin: 45,
    loot: "",
    boss: "Ferumbras",
    items: "Ferumbras' Hat; Gold Token; Platinum Coin",
    notes: "Time fechado, foi liso.",
    createdAt: "2026-03-02T00:00:00.000Z",
  },
  {
    id: "h-demo",
    type: "hunt",
    huntName: "Dragon Hunt",
    vocation: "MS",
    level: 80,
    xp: 450000,
    profit: 60000,
    durationMin: 60,
    loot: "Dragon Ham; Green Dragon Scale",
    boss: "",
    items: "",
    notes: "Solo, spawn estável.",
    createdAt: "2026-03-03T00:00:00.000Z",
  },
];

const AppStoreContext = createContext(/** @type {any} */ (null));

function nowISO() {
  return new Date().toISOString();
}

async function getOrCreateUserId() {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.userId);
  if (existing) return existing;

  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(STORAGE_KEYS.userId, id);
  return id;
}

export function AppStoreProvider({ children }) {
  const [isReady, setIsReady] = useState(false);

  const [userId, setUserId] = useState("");
  const [points, setPoints] = useState(0);

  const [quests, setQuests] = useState([]);
  const [forumThreads, setForumThreads] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Load
  useEffect(() => {
    (async () => {
      const uid = await getOrCreateUserId();
      setUserId(uid);

      const p = await AsyncStorage.getItem(STORAGE_KEYS.points);
      setPoints(p ? Number(p) : 0);

      const q = await AsyncStorage.getItem(STORAGE_KEYS.quests);
      setQuests(q ? JSON.parse(q) : []);

      const f = await AsyncStorage.getItem(STORAGE_KEYS.forumThreads);
      setForumThreads(f ? JSON.parse(f) : []);

      const r = await AsyncStorage.getItem(STORAGE_KEYS.redemptions);
      setRedemptions(r ? JSON.parse(r) : []);

      const s = await AsyncStorage.getItem(STORAGE_KEYS.sessions);
      setSessions(s ? JSON.parse(s) : DEFAULT_SESSIONS);

      setIsReady(true);
    })();
  }, []);

  // Persist
  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.points, String(points));
  }, [points, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.quests, JSON.stringify(quests));
  }, [quests, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.forumThreads, JSON.stringify(forumThreads));
  }, [forumThreads, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.redemptions, JSON.stringify(redemptions));
  }, [redemptions, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
  }, [sessions, isReady]);

  // Quest Board
  function createQuest(payload = {}) {
    const t = String(payload.title || "").trim();
    const d = String(payload.description || "").trim();
    if (!t || !d) return;

    const quest = {
      id: Crypto.randomUUID(),
      title: t,
      description: d,
      type: payload.type || "Other",
      photoUri: payload.photoUri || null,
      meta: payload.meta || {},
      status: "open", // open | resolved
      createdAt: nowISO(),
      resolvedAt: null,
      rewardPoints: 25,
      createdByUserId: userId,
    };

    setQuests((prev) => [quest, ...prev]);
  }

  function createSession(payload = {}) {
    const type = payload.type === "boss" ? "boss" : "hunt";
    const huntName = String(payload.huntName || payload.boss || "").trim();
    if (!huntName) return;

    const session = {
      id: Crypto.randomUUID(),
      type,
      huntName,
      vocation: String(payload.vocation || "").trim(),
      level: payload.level ? Number(payload.level) : null,
      xp: Number(payload.xp || 0) || 0,
      profit: Number(payload.profit || 0) || 0,
      durationMin: Number(payload.durationMin || 0) || 0,
      loot: String(payload.loot || "").trim(),
      boss: String(payload.boss || "").trim(),
      items: String(payload.items || "").trim(),
      notes: String(payload.notes || "").trim(),
      createdAt: payload.createdAt || nowISO(),
    };

    setSessions((prev) => [session, ...prev]);
  }

  function deleteSession(id) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function resolveQuest(questId) {
    const quest = quests.find((q) => q.id === questId);
    if (!quest || quest.status === "resolved") return;

    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId ? { ...q, status: "resolved", resolvedAt: nowISO() } : q
      )
    );

    // credita pontos para o autor (front-only: app é do usuário atual)
    if (quest.createdByUserId === userId) {
      setPoints((p) => p + Number(quest.rewardPoints || 0));
    }
  }

  // Fórum
  function createThread({ title, body }) {
    const t = String(title || "").trim();
    const b = String(body || "").trim();
    if (!t || !b) return;

    const thread = {
      id: Crypto.randomUUID(),
      title: t,
      body: b,
      status: "open", // open | closed
      createdAt: nowISO(),
      createdByUserId: userId,
      comments: [],
    };

    setForumThreads((prev) => [thread, ...prev]);
  }

  function closeThread(threadId) {
    setForumThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, status: "closed" } : t))
    );
  }

  function addComment(threadId, text) {
    const commentText = String(text || "").trim();
    if (!commentText) return;

    const comment = {
      id: Crypto.randomUUID(),
      text: commentText,
      createdAt: nowISO(),
      createdByUserId: userId,
    };

    setForumThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, comments: [comment, ...(t.comments || [])] } : t
      )
    );
  }

  // Shop
  function redeem({ itemId, title, cost }) {
    const c = Number(cost || 0);
    if (!Number.isFinite(c) || c <= 0) return { ok: false, message: "Custo inválido." };
    if (points < c) return { ok: false, message: "Pontos insuficientes." };

    setPoints((p) => p - c);

    const redemption = {
      id: Crypto.randomUUID(),
      itemId: String(itemId || ""),
      title: String(title || ""),
      cost: c,
      createdAt: nowISO(),
      userId,
    };

    setRedemptions((prev) => [redemption, ...prev]);
    return { ok: true, message: "Resgatado com sucesso (mock)!" };
  }

  async function resetAll() {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    const uid = await getOrCreateUserId();
    setUserId(uid);
    setPoints(0);
    setQuests([]);
    setForumThreads([]);
    setRedemptions([]);
    setSessions(DEFAULT_SESSIONS);
  }

  const value = useMemo(
    () => ({
      isReady,
      userId,
      points,
      quests,
      forumThreads,
      redemptions,
      sessions,
      actions: {
        createQuest,
        resolveQuest,
        createThread,
        closeThread,
        addComment,
        redeem,
        resetAll,
        createSession,
        deleteSession,
      },
    }),
    [isReady, userId, points, quests, forumThreads, redemptions, sessions]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}