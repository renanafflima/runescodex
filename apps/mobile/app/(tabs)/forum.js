import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppButton from "@/components/ui/AppButton";
import EmptyState from "@/components/ui/EmptyState";
import {
  closeForumThread,
  createForumReply,
  createForumThread,
  listForumThreads,
} from "@/src/api/forum";

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 401) return t("auth.sessionExpired");
  if (error?.status === 403) return t("forum.forbidden");
  if (error?.status === 400) return t("auth.invalidPayload");
  return t("auth.genericError");
}

function authorLabel(item) {
  const email = item?.author?.email;
  if (email && email.includes("@")) return email.split("@")[0];
  return email || item?.createdByUserId || "";
}

function authorInitial(item) {
  const label = authorLabel(item);
  return label ? label.slice(0, 1).toUpperCase() : "?";
}

function viewCountOf(item) {
  const value = item?.viewCount ?? item?.views ?? item?.visualizations;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function replyCountOf(item) {
  if (item?.replyCount != null && Number.isFinite(Number(item.replyCount))) {
    return Number(item.replyCount);
  }
  return Array.isArray(item?.comments) ? item.comments.length : 0;
}

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} d`;
  return date.toLocaleDateString();
}

export default function ForumScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentText, setCommentText] = useState({});
  const [tab, setTab] = useState("recent");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listForumThreads();
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      setThreads([]);
      setError(mapError(err, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadThreads();
    }, [loadThreads]),
  );

  const visibleThreads = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    let list = threads.filter((item) => {
      if (!search) return true;
      return (
        String(item.title || "").toLocaleLowerCase().includes(search) ||
        String(item.body || "").toLocaleLowerCase().includes(search) ||
        authorLabel(item).toLocaleLowerCase().includes(search)
      );
    });

    if (tab === "unanswered") {
      list = list.filter((item) => replyCountOf(item) === 0);
    }

    list = [...list].sort((a, b) => {
      if (tab === "viewed") {
        const aViews = viewCountOf(a);
        const bViews = viewCountOf(b);
        if (aViews != null || bViews != null) {
          return (bViews ?? -1) - (aViews ?? -1);
        }
      }
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return list;
  }, [query, tab, threads]);

  async function publishThread() {
    if (!isAuthenticated) {
      setActionError(t("forum.loginRequired"));
      return;
    }
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    setActionError("");
    try {
      await createForumThread(token, { title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setComposerOpen(false);
      await loadThreads();
    } catch (err) {
      setActionError(mapError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function closeThread(id) {
    if (!isAuthenticated) {
      setActionError(t("forum.loginRequired"));
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await closeForumThread(token, id);
      await loadThreads();
    } catch (err) {
      setActionError(mapError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(id) {
    if (!isAuthenticated) {
      setActionError(t("forum.loginRequired"));
      return;
    }
    const value = (commentText[id] ?? "").trim();
    if (!value) return;
    setBusy(true);
    setActionError("");
    try {
      await createForumReply(token, id, { body: value });
      setCommentText((prev) => ({ ...prev, [id]: "" }));
      await loadThreads();
    } catch (err) {
      setActionError(mapError(err, t));
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "recent", label: t("forum.recent") },
    { id: "viewed", label: t("forum.mostViewed") },
    { id: "unanswered", label: t("forum.unanswered") },
  ];

  return (
    <AppScreen>
      <FlatList
        data={error ? [] : visibleThreads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.top}>
              <View style={styles.topCopy}>
                <Text style={styles.title}>{t("forum.title")}</Text>
                <Text style={styles.subtitle}>{t("forum.subtitle")}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setComposerOpen((open) => !open);
                  setActionError("");
                }}
                style={styles.newBtn}
                accessibilityLabel={t("forum.newTopic")}
              >
                <Ionicons name="add" size={26} color={Colors.goldLight} />
              </Pressable>
            </View>

            <View style={styles.tabs}>
              {tabs.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  style={[styles.tab, tab === item.id && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("forum.search")}
              placeholderTextColor={Colors.textMuted}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {composerOpen ? (
              <View style={styles.composer}>
                <Text style={styles.composerTitle}>{t("forum.newTopic")}</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("forum.topicTitle")}
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.bodyInput]}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t("forum.topicBody")}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                <AppButton
                  label={t("forum.publish")}
                  disabled={busy || !isAuthenticated}
                  onPress={publishThread}
                />
                {!isAuthenticated ? (
                  <AppButton
                    label={t("auth.login")}
                    variant="ghost"
                    onPress={() => router.push("/(auth)/login")}
                  />
                ) : null}
                {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
              </View>
            ) : actionError ? (
              <Text style={styles.error}>{actionError}</Text>
            ) : null}

            {!isAuthenticated && !composerOpen ? (
              <Text style={styles.loginHint}>{t("forum.loginRequired")}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          const views = viewCountOf(item);
          const replies = replyCountOf(item);
          const when = formatRelativeTime(item.createdAt);
          const author = authorLabel(item);
          return (
            <Pressable
              onPress={() => setExpandedId(expanded ? null : item.id)}
              style={styles.thread}
            >
              <View style={styles.threadHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{authorInitial(item)}</Text>
                </View>
                <View style={styles.threadContent}>
                  <Text style={styles.threadTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.author} numberOfLines={1}>
                    {[author, when].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>

              {item.body ? (
                <Text style={styles.preview} numberOfLines={expanded ? 6 : 2}>
                  {item.body}
                </Text>
              ) : null}

              <View style={styles.metrics}>
                {views != null ? (
                  <View style={styles.metric}>
                    <Ionicons name="eye-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.metricText}>
                      <Text style={styles.metricStrong}>{views}</Text> {t("forum.views")}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.metric}>
                  <Ionicons name="chatbubble-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metricText}>
                    <Text style={styles.metricStrong}>{replies}</Text> {t("forum.replies")}
                  </Text>
                </View>
                <Text style={[styles.status, item.status !== "open" && styles.statusClosed]}>
                  {item.status === "open" ? t("common.open") : t("common.closed")}
                </Text>
              </View>

              {expanded ? (
                <View style={styles.expanded}>
                  <AppButton
                    label={t("forum.closeTopic")}
                    variant="ghost"
                    disabled={busy || item.status !== "open" || !isAuthenticated}
                    onPress={() => item.status === "open" && closeThread(item.id)}
                  />
                  <TextInput
                    style={styles.input}
                    value={commentText[item.id] ?? ""}
                    onChangeText={(value) => setCommentText((prev) => ({ ...prev, [item.id]: value }))}
                    placeholder={t("forum.commentPlaceholder")}
                    placeholderTextColor={Colors.textMuted}
                    editable={item.status === "open"}
                  />
                  <AppButton
                    label={t("forum.send")}
                    variant="secondary"
                    disabled={busy || item.status !== "open" || !isAuthenticated}
                    onPress={() => sendComment(item.id)}
                  />
                  {(item.comments ?? []).slice(0, 5).map((comment) => (
                    <View key={comment.id} style={styles.comment}>
                      <Text style={styles.commentAuthor}>{authorLabel(comment)}</Text>
                      <Text style={styles.commentBody}>{comment.text}</Text>
                    </View>
                  ))}
                  {(item.comments ?? []).length > 5 || replies > 5 ? (
                    <Text style={styles.more}>{t("forum.moreComments")}</Text>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.goldLight} style={{ marginTop: 16 }} />
          ) : error ? (
            <View style={{ gap: 12, marginTop: 8 }}>
              <EmptyState title={error} />
              <AppButton label={t("forum.retry")} onPress={loadThreads} />
            </View>
          ) : (
            <EmptyState title={t("forum.empty")} />
          )
        }
        ListFooterComponent={
          !loading && !error && visibleThreads.length ? (
            <Text style={styles.footer}>{t("forum.communityFooter")}</Text>
          ) : null
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md, paddingTop: 18, paddingBottom: 30 },
  header: { marginBottom: 4 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  topCopy: { flex: 1, minWidth: 0 },
  title: { color: Colors.text, fontSize: 25, fontWeight: "800", letterSpacing: 0.3 },
  subtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  newBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.45)",
    backgroundColor: "rgba(197,155,76,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  tab: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: "rgba(197,155,76,0.16)",
    borderColor: "rgba(197,155,76,0.35)",
  },
  tabText: { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: Colors.goldLight },
  search: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.045)",
    color: Colors.text,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
    fontWeight: "600",
  },
  loginHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 8 },
  composer: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  composerTitle: { color: Colors.text, fontSize: 15, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
  },
  bodyInput: { height: 80, textAlignVertical: "top" },
  error: { color: Colors.danger, fontSize: Type.secondary, fontWeight: "700" },
  thread: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  threadHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(197,155,76,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.gold, fontSize: 15, fontWeight: "800" },
  threadContent: { flex: 1, minWidth: 0 },
  threadTitle: { color: Colors.text, fontSize: 15, lineHeight: 19, fontWeight: "800" },
  author: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  preview: {
    marginTop: 9,
    marginLeft: 44,
    color: "#b6bfcc",
    fontSize: 12,
    lineHeight: 17,
  },
  metrics: {
    marginLeft: 44,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 15,
  },
  metric: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricText: { color: Colors.textMuted, fontSize: 11 },
  metricStrong: { color: "#c4ccd7", fontWeight: "700" },
  status: { marginLeft: "auto", color: "#7fc58d", fontSize: 11, fontWeight: "700" },
  statusClosed: { color: "#9aa3b1" },
  expanded: { marginTop: 12, gap: 8 },
  comment: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
  },
  commentAuthor: { color: Colors.text, fontWeight: "800", fontSize: Type.secondary },
  commentBody: { color: Colors.textSecondary, fontSize: Type.body, lineHeight: 18 },
  more: { color: Colors.textMuted, fontSize: 11 },
  footer: {
    textAlign: "center",
    color: "#687486",
    fontSize: 10,
    marginTop: 8,
    marginBottom: 12,
  },
});
