import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { useAppStore } from "../store/AppStore";

export default function ForumScreen() {
  const { userId, forumThreads, actions } = useAppStore();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [commentText, setCommentText] = useState({});
  const [filter, setFilter] = useState("all"); // all/open/closed

  const threads = useMemo(() => {
    if (filter === "all") return forumThreads;
    return forumThreads.filter((t) => t.status === filter);
  }, [forumThreads, filter]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fórum</Text>
      <Text style={styles.sub}>Seu ID: {userId}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Abrir tópico</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Título" />
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={body}
          onChangeText={setBody}
          placeholder="Descrição / dúvida"
          multiline
        />
        <Pressable
          style={styles.btn}
          onPress={() => {
            if (!title.trim() || !body.trim()) return;
            actions.createThread({ title, body });
            setTitle("");
            setBody("");
          }}
        >
          <Text style={styles.btnText}>Publicar</Text>
        </Pressable>

        <View style={styles.row}>
          {["all", "open", "closed"].map((k) => (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              style={[styles.chip, filter === k && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>
                {k === "all" ? "Todos" : k === "open" ? "Abertos" : "Fechados"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.thread}>
            <View style={styles.rowBetween}>
              <Text style={styles.threadTitle}>{item.title}</Text>
              <Text style={[styles.badge, item.status === "open" ? styles.badgeOpen : styles.badgeClosed]}>
                {item.status.toUpperCase()}
              </Text>
            </View>

            <Text style={{ opacity: 0.8, marginBottom: 6 }}>{item.body}</Text>
            <Text style={styles.meta}>Autor: {item.createdByUserId}</Text>

            <View style={styles.rowBetween}>
              <Pressable
                style={[styles.smallBtn, item.status !== "open" && { opacity: 0.5 }]}
                onPress={() => item.status === "open" && actions.closeThread(item.id)}
              >
                <Text style={styles.smallBtnText}>Fechar tópico</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 10, gap: 8 }}>
              <Text style={{ fontWeight: "700" }}>Comentar</Text>
              <TextInput
                style={styles.input}
                value={commentText[item.id] ?? ""}
                onChangeText={(t) => setCommentText((p) => ({ ...p, [item.id]: t }))}
                placeholder="Escreva um comentário"
              />
              <Pressable
                style={[styles.smallBtn, item.status !== "open" && { opacity: 0.5 }]}
                onPress={() => {
                  if (item.status !== "open") return;
                  const t = (commentText[item.id] ?? "").trim();
                  if (!t) return;
                  actions.addComment(item.id, t);
                  setCommentText((p) => ({ ...p, [item.id]: "" }));
                }}
              >
                <Text style={styles.smallBtnText}>Enviar</Text>
              </Pressable>

              {(item.comments ?? []).length > 0 && (
                <View style={styles.comments}>
                  {(item.comments ?? []).slice(0, 5).map((c) => (
                    <View key={c.id} style={styles.comment}>
                      <Text style={{ fontWeight: "700" }}>{c.createdByUserId}</Text>
                      <Text>{c.text}</Text>
                    </View>
                  ))}
                  {(item.comments ?? []).length > 5 && (
                    <Text style={{ opacity: 0.6 }}>Mostrando últimos 5 comentários…</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ opacity: 0.7 }}>Nenhum tópico ainda. Crie o primeiro!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { opacity: 0.7 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 12, padding: 10 },
  btn: { backgroundColor: "#111", padding: 12, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 999 },
  chipActive: { backgroundColor: "#111" },
  chipText: { fontSize: 12 },
  chipTextActive: { color: "#fff" },

  thread: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, marginBottom: 10 },
  threadTitle: { fontSize: 16, fontWeight: "700", flex: 1, paddingRight: 8 },
  meta: { opacity: 0.6, fontSize: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, overflow: "hidden" },
  badgeOpen: { backgroundColor: "#E8F5E9" },
  badgeClosed: { backgroundColor: "#FFEBEE" },

  smallBtn: { borderWidth: 1, padding: 10, borderRadius: 12, alignItems: "center" },
  smallBtnText: { fontWeight: "700" },

  comments: { gap: 8, marginTop: 8 },
  comment: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
});