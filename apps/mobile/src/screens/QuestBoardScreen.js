import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, StyleSheet, Alert } from "react-native";
import { useAppStore } from "../store/AppStore";

export default function QuestBoardScreen() {
  const { userId, points, quests, actions } = useAppStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("all"); // all/open/resolved

  const data = useMemo(() => {
    if (filter === "all") return quests;
    return quests.filter((q) => q.status === filter);
  }, [quests, filter]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quest Board</Text>
      <Text style={styles.sub}>Seu ID: {userId}</Text>
      <Text style={styles.sub}>Pontos: {points}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Abrir chamado</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Título (erro, melhoria, nova função)" />
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descreva o pedido"
          multiline
        />
        <Pressable
          style={styles.btn}
          onPress={() => {
            if (!title.trim() || !description.trim()) return;
            actions.createQuest({ title, description });
            setTitle("");
            setDescription("");
          }}
        >
          <Text style={styles.btnText}>Enviar chamado</Text>
        </Pressable>

        <View style={styles.row}>
          {["all", "open", "resolved"].map((k) => (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              style={[styles.chip, filter === k && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>
                {k === "all" ? "Todos" : k === "open" ? "Abertos" : "Resolvidos"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ opacity: 0.7, fontSize: 12 }}>
          * Front-only: “Resolver” simula admin e credita pontos ao autor do chamado (userId).
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.quest}>
            <View style={styles.rowBetween}>
              <Text style={styles.questTitle}>{item.title}</Text>
              <Text style={[styles.badge, item.status === "open" ? styles.badgeOpen : styles.badgeClosed]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={{ opacity: 0.85 }}>{item.description}</Text>
            <Text style={styles.meta}>Autor: {item.createdByUserId}</Text>
            <Text style={styles.meta}>Recompensa: +{item.rewardPoints} pontos</Text>

            <Pressable
              style={[styles.smallBtn, item.status !== "open" && { opacity: 0.5 }]}
              onPress={() => {
                if (item.status !== "open") return;
                Alert.alert(
                  "Marcar como resolvido?",
                  `Isso vai adicionar +${item.rewardPoints} pontos (mock) ao autor do chamado.`,
                  [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Resolver", style: "default", onPress: () => actions.resolveQuest(item.id) },
                  ]
                );
              }}
            >
              <Text style={styles.smallBtnText}>Resolver (simular admin)</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ opacity: 0.7 }}>Nenhum chamado ainda.</Text>}
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

  quest: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginBottom: 10 },
  questTitle: { fontSize: 16, fontWeight: "700", flex: 1, paddingRight: 8 },
  meta: { opacity: 0.6, fontSize: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, overflow: "hidden" },
  badgeOpen: { backgroundColor: "#E8F5E9" },
  badgeClosed: { backgroundColor: "#E3F2FD" },

  smallBtn: { borderWidth: 1, padding: 10, borderRadius: 12, alignItems: "center" },
  smallBtnText: { fontWeight: "700" },
});