import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import {
  closeForumThread,
  createForumReply,
  createForumThread,
  listForumThreads,
} from "@/src/api/forum";

const GOLD = "#d9ad3f";
const GOLD2 = "#f0cf70";
const BLUE = "#8dccff";
const LINE = "rgba(217,173,63,0.30)";

const backgroundForum = require("../../assets/forum/background_forum.png");
const heroForum = require("../../assets/forum/hero_forum.png");

const CATEGORIES = [
  {
    id: "bestiary",
    titleKey: "forum.catBestiary",
    hintKey: "forum.catBestiaryHint",
    image: require("../../assets/forum/bestiario.png"),
  },
  {
    id: "hunts",
    titleKey: "forum.catHunts",
    hintKey: "forum.catHuntsHint",
    image: require("../../assets/forum/hunt.png"),
  },
  {
    id: "profit",
    titleKey: "forum.catProfit",
    hintKey: "forum.catProfitHint",
    image: require("../../assets/forum/profit.png"),
  },
  {
    id: "xp",
    titleKey: "forum.catXp",
    hintKey: "forum.catXpHint",
    image: require("../../assets/forum/xphora.png"),
  },
  {
    id: "tips",
    titleKey: "forum.catTips",
    hintKey: "forum.catTipsHint",
    image: require("../../assets/forum/dicas.png"),
  },
];

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
  return email || "";
}

function replyCountOf(item) {
  if (item?.replyCount != null && Number.isFinite(Number(item.replyCount))) {
    return Number(item.replyCount);
  }
  return Array.isArray(item?.comments) ? item.comments.length : 0;
}

function categoryOf(item) {
  const value = item?.category ?? item?.categoryName ?? item?.topicCategory;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isFeatured(item) {
  return item?.featured === true || item?.highlight === true || item?.pinned === true;
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
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const router = useRouter();
  const { token, isAuthenticated, user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentText, setCommentText] = useState({});
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

  const recentThreads = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return threads
      .filter((item) => {
        if (!search) return true;
        return (
          String(item.title || "").toLocaleLowerCase().includes(search) ||
          String(item.body || "").toLocaleLowerCase().includes(search) ||
          authorLabel(item).toLocaleLowerCase().includes(search) ||
          categoryOf(item).toLocaleLowerCase().includes(search)
        );
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [query, threads]);

  const featuredThreads = useMemo(() => threads.filter(isFeatured), [threads]);

  const columns = width >= 720 ? 3 : 2;
  const pagePad = 16;
  const sectionPad = 15;
  const cardGap = 11;
  const cardWidth = Math.floor(
    (width - pagePad * 2 - sectionPad * 2 - cardGap * (columns - 1)) / columns,
  );
  const heroHeight = width < 400 ? 220 : 260;
  const stackCta = width < 420;

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

  const canClose = (item) =>
    isAuthenticated && item.status === "open" && user?.id && item.author?.id === user.id;

  return (
    <AppScreen>
      <ImageBackground source={backgroundForum} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(4,10,17,0.38)", "rgba(4,10,17,0.72)", "rgba(4,10,17,0.92)"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={[styles.hero, { height: heroHeight }]}>
            <Image source={heroForum} style={styles.heroArt} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(4,10,17,0.82)", "rgba(4,10,17,0.28)", "rgba(4,10,17,0.18)"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["transparent", "rgba(4,10,17,0.78)"]}
              style={styles.heroBottom}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{t("forum.heroKicker")}</Text>
              <Text style={styles.heroTitle}>{t("forum.heroTitle")}</Text>
              <Text style={styles.heroSub}>{t("forum.heroSubtitle")}</Text>
            </View>
          </View>

          <View style={styles.search}>
            <Ionicons name="search" size={18} color="#93a1b2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("forum.searchPlaceholder")}
              placeholderTextColor="#647386"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.composer, stackCta && styles.composerStack]}>
            <View style={styles.composerCopy}>
              <Text style={styles.composerTitle}>{t("forum.shareTitle")}</Text>
              <Text style={styles.composerBody}>{t("forum.shareBody")}</Text>
            </View>
            <Pressable
              onPress={() => {
                setComposerOpen((open) => !open);
                setActionError("");
              }}
              style={[styles.cta, stackCta && styles.ctaFull]}
            >
              <Text style={styles.ctaText}>{t("forum.createDiscussion")}</Text>
            </Pressable>
          </View>

          {composerOpen ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t("forum.topicTitle")}
                placeholderTextColor="#647386"
              />
              <TextInput
                style={[styles.input, styles.bodyInput]}
                value={body}
                onChangeText={setBody}
                placeholder={t("forum.topicBody")}
                placeholderTextColor="#647386"
                multiline
              />
              <Pressable
                onPress={publishThread}
                disabled={busy || !title.trim() || !body.trim()}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{busy ? t("common.loading") : t("forum.publish")}</Text>
              </Pressable>
              {!isAuthenticated ? (
                <Pressable onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.link}>{t("auth.login")}</Text>
                </Pressable>
              ) : null}
              {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{t("forum.highlights")}</Text>
                <Text style={styles.sectionHint}>{t("forum.highlightsHint")}</Text>
              </View>
              <Text style={styles.sectionMeta}>{t("forum.highlightsMeta")}</Text>
            </View>
            {featuredThreads.map((item) => (
              <View key={item.id} style={styles.feature}>
                {categoryOf(item) ? <Text style={styles.featureTag}>{categoryOf(item)}</Text> : null}
                <Text style={styles.featureTitle}>{item.title}</Text>
                {item.body ? (
                  <Text style={styles.featureBody} numberOfLines={3}>
                    {item.body}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{t("forum.categoriesTitle")}</Text>
                <Text style={styles.sectionHint}>{t("forum.categoriesHint")}</Text>
              </View>
            </View>
            <View style={[styles.categoryGrid, { gap: cardGap }]}>
              {CATEGORIES.map((item) => (
                <View
                  key={item.id}
                  style={[styles.category, { width: cardWidth, minHeight: width < 400 ? 132 : 145 }]}
                >
                  <Image source={item.image} style={styles.categoryArt} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(3,9,15,0.05)", "rgba(3,9,15,0.94)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.categoryCopy}>
                    <Text style={styles.categoryTitle}>{t(item.titleKey)}</Text>
                    <Text style={styles.categoryHint}>{t(item.hintKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>
                  {t("forum.recentTitle")} <Text style={styles.sectionAccent}>{t("forum.recentAccent")}</Text>
                </Text>
                <Text style={styles.sectionHint}>{t("forum.recentHint")}</Text>
              </View>
            </View>

            {loading ? <ActivityIndicator color={GOLD2} style={{ marginVertical: 12 }} /> : null}
            {error ? (
              <Pressable onPress={loadThreads}>
                <Text style={styles.error}>{error}</Text>
                <Text style={styles.link}>{t("forum.retry")}</Text>
              </Pressable>
            ) : null}
            {!loading && !error && recentThreads.length === 0 ? (
              <Text style={styles.empty}>{t("forum.empty")}</Text>
            ) : null}

            {recentThreads.map((item, index) => {
              const expanded = expandedId === item.id;
              const replies = replyCountOf(item);
              const author = authorLabel(item);
              const when = formatRelativeTime(item.createdAt);
              const category = categoryOf(item);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setExpandedId(expanded ? null : item.id)}
                  style={[styles.discussion, index > 0 && styles.discussionBorder]}
                >
                  <View style={styles.discussionMain}>
                    <Text style={styles.discussionTitle}>{item.title}</Text>
                    {item.body ? (
                      <Text style={styles.discussionBody} numberOfLines={expanded ? 6 : 2}>
                        {item.body}
                      </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      {category ? <Text style={styles.badge}>{category}</Text> : null}
                      {author ? <Text style={styles.meta}>{t("forum.byAuthor", { name: author })}</Text> : null}
                      {when ? <Text style={styles.meta}>{when}</Text> : null}
                    </View>
                    {expanded ? (
                      <View style={styles.expanded}>
                        {canClose(item) ? (
                          <Pressable onPress={() => closeThread(item.id)} disabled={busy}>
                            <Text style={styles.link}>{t("forum.closeTopic")}</Text>
                          </Pressable>
                        ) : null}
                        <TextInput
                          style={styles.input}
                          value={commentText[item.id] ?? ""}
                          onChangeText={(value) => setCommentText((prev) => ({ ...prev, [item.id]: value }))}
                          placeholder={t("forum.commentPlaceholder")}
                          placeholderTextColor="#647386"
                          editable={item.status === "open"}
                        />
                        <Pressable
                          onPress={() => sendComment(item.id)}
                          disabled={busy || item.status !== "open"}
                          style={styles.replyBtn}
                        >
                          <Text style={styles.replyText}>{t("forum.send")}</Text>
                        </Pressable>
                        {(item.comments ?? []).slice(0, 5).map((comment) => (
                          <View key={comment.id} style={styles.comment}>
                            <Text style={styles.commentAuthor}>{authorLabel(comment)}</Text>
                            <Text style={styles.commentBody}>{comment.text}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.replies}>
                    <Text style={styles.repliesCount}>{replies}</Text>
                    <Text style={styles.repliesLabel}>{t("forum.replies")}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ImageBackground>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  hero: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#091522",
  },
  heroArt: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 18 },
  heroKicker: {
    color: GOLD2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: Colors.text,
    fontFamily: "serif",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  heroSub: { color: "#d5dde7", fontSize: 13, lineHeight: 19, marginTop: 6 },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(8,18,29,0.88)",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14, paddingVertical: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "rgba(12,26,40,0.94)",
  },
  composerStack: { flexDirection: "column", alignItems: "stretch" },
  composerCopy: { flex: 1, minWidth: 0, gap: 4 },
  composerTitle: { color: Colors.text, fontFamily: "serif", fontSize: 18, fontWeight: "700" },
  composerBody: { color: "#93a1b2", fontSize: 13, lineHeight: 18 },
  cta: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
  },
  ctaFull: { alignSelf: "stretch" },
  ctaText: {
    color: "#101722",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  form: { gap: 10, marginTop: -6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(8,18,29,0.88)",
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
  },
  bodyInput: { minHeight: 88, textAlignVertical: "top" },
  section: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(9,20,33,0.92)",
    gap: 12,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionCopy: { flex: 1, minWidth: 0, gap: 4 },
  sectionTitle: { color: Colors.text, fontFamily: "serif", fontSize: 22, fontWeight: "700" },
  sectionAccent: { color: GOLD2 },
  sectionHint: { color: "#93a1b2", fontSize: 12, lineHeight: 16 },
  sectionMeta: { color: "#647386", fontSize: 12 },
  feature: {
    borderWidth: 1,
    borderColor: "rgba(76,169,255,0.20)",
    backgroundColor: "rgba(7,18,30,0.72)",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  featureTag: {
    color: BLUE,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  featureTitle: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  featureBody: { color: "#93a1b2", fontSize: 12, lineHeight: 18 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap" },
  category: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.22)",
    backgroundColor: "#0a1522",
    justifyContent: "flex-end",
  },
  categoryArt: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  categoryCopy: { paddingHorizontal: 12, paddingBottom: 11, paddingTop: 28 },
  categoryTitle: {
    color: Colors.text,
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  categoryHint: { color: "#aeb9c7", fontSize: 11, marginTop: 3 },
  discussion: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  discussionBorder: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  discussionMain: { flex: 1, minWidth: 0, gap: 4 },
  discussionTitle: { color: Colors.text, fontSize: 14, fontWeight: "700" },
  discussionBody: { color: "#93a1b2", fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  badge: { color: GOLD2, fontSize: 11, fontWeight: "800" },
  meta: { color: "#647386", fontSize: 11 },
  replies: { alignItems: "flex-end", minWidth: 64 },
  repliesCount: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  repliesLabel: { color: "#93a1b2", fontSize: 11 },
  expanded: { marginTop: 8, gap: 8 },
  replyBtn: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(76,169,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  replyText: { color: BLUE, fontWeight: "800", fontSize: 12 },
  comment: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: "rgba(7,16,27,0.72)",
  },
  commentAuthor: { color: Colors.text, fontWeight: "800", fontSize: Type.secondary },
  commentBody: { color: "#d5dde7", fontSize: Type.body, lineHeight: 18, marginTop: 2 },
  empty: { color: "#93a1b2", fontSize: 13 },
  error: { color: Colors.danger, fontSize: Type.secondary, fontWeight: "700" },
  link: { color: GOLD2, fontSize: 13, fontWeight: "700", marginTop: 4 },
});
