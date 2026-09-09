import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppStore } from "@/src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppChip from "@/components/ui/AppChip";
import EmptyState from "@/components/ui/EmptyState";

export default function ForumScreen() {
  const { userId, forumThreads, actions } = useAppStore();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentText, setCommentText] = useState({});
  const [filter, setFilter] = useState("all");

  const threads = useMemo(() => {
    if (filter === "all") return forumThreads;
    return forumThreads.filter((item) => item.status === filter);
  }, [forumThreads, filter]);

  return (
    <AppScreen>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>{t("forum.title")}</Text>
            <Text style={styles.subtitle}>{t("forum.subtitle")}</Text>
            <Text style={styles.meta}>{t("home.yourId")}: {userId}</Text>

            <AppCard>
              <Text style={styles.cardTitle}>{t("forum.newTopic")}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t("forum.topicTitle")}
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                value={body}
                onChangeText={setBody}
                placeholder={t("forum.topicBody")}
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              <AppButton
                label={t("forum.publish")}
                onPress={() => {
                  if (!title.trim() || !body.trim()) return;
                  actions.createThread({ title, body });
                  setTitle("");
                  setBody("");
                }}
              />
              <View style={styles.row}>
                <AppChip label={t("common.all")} active={filter === "all"} onPress={() => setFilter("all")} />
                <AppChip label={t("common.open")} active={filter === "open"} onPress={() => setFilter("open")} />
                <AppChip label={t("common.closed")} active={filter === "closed"} onPress={() => setFilter("closed")} />
              </View>
            </AppCard>
          </View>
        }
        renderItem={({ item }) => (
          <AppCard>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{item.title}</Text>
              <View style={[styles.badge, item.status === "open" ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={styles.badgeText}>
                  {item.status === "open" ? t("common.open") : t("common.closed")}
                </Text>
              </View>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.meta}>
              {t("forum.author")}: {item.createdByUserId}
            </Text>
            <Text style={styles.meta}>{t("forum.comments", { count: (item.comments || []).length })}</Text>

            <AppButton
              label={t("forum.closeTopic")}
              variant="ghost"
              disabled={item.status !== "open"}
              onPress={() => item.status === "open" && actions.closeThread(item.id)}
            />

            <Text style={styles.cardTitle}>{t("forum.comment")}</Text>
            <TextInput
              style={styles.input}
              value={commentText[item.id] ?? ""}
              onChangeText={(value) => setCommentText((prev) => ({ ...prev, [item.id]: value }))}
              placeholder={t("forum.commentPlaceholder")}
              placeholderTextColor={Colors.textMuted}
            />
            <AppButton
              label={t("forum.send")}
              variant="secondary"
              disabled={item.status !== "open"}
              onPress={() => {
                if (item.status !== "open") return;
                const value = (commentText[item.id] ?? "").trim();
                if (!value) return;
                actions.addComment(item.id, value);
                setCommentText((prev) => ({ ...prev, [item.id]: "" }));
              }}
            />

            {(item.comments ?? []).slice(0, 5).map((comment) => (
              <View key={comment.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{comment.createdByUserId}</Text>
                <Text style={styles.body}>{comment.text}</Text>
              </View>
            ))}
            {(item.comments ?? []).length > 5 ? (
              <Text style={styles.meta}>{t("forum.moreComments")}</Text>
            ) : null}
          </AppCard>
        )}
        ListEmptyComponent={<EmptyState title={t("forum.empty")} />}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 12, paddingBottom: 28 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary },
  cardTitle: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  body: { color: Colors.textSecondary, fontSize: Type.body, lineHeight: 20 },
  meta: { color: Colors.textMuted, fontSize: Type.tiny },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  badgeOpen: { borderColor: "rgba(212,167,44,0.4)", backgroundColor: "rgba(212,167,44,0.12)" },
  badgeClosed: { borderColor: Colors.border, backgroundColor: Colors.bgSecondary },
  badgeText: { color: Colors.text, fontSize: Type.tiny, fontWeight: "800" },
  comment: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
  },
  commentAuthor: { color: Colors.text, fontWeight: "800", fontSize: Type.secondary },
});
