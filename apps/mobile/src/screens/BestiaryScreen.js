import React, { useMemo, useState } from "react";
import { FlatList, Text, View, Pressable, StyleSheet } from "react-native";
import { CREATURES } from "../data/mock";

const DIFFS = ["All", "Easy", "Medium", "Hard", "Very Hard"];

export default function BestiaryScreen() {
  const [difficulty, setDifficulty] = useState("All");

  const data = useMemo(() => {
    if (difficulty === "All") return CREATURES;
    return CREATURES.filter((c) => c.difficulty === difficulty);
  }, [difficulty]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bestiário</Text>

      <View style={styles.filters}>
        {DIFFS.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDifficulty(d)}
            style={[styles.chip, difficulty === d && styles.chipActive]}
          >
            <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text>Dificuldade: {item.difficulty}</Text>
            <Text>Vida: {item.hp}</Text>
            <Text>Local: {item.location}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 999 },
  chipActive: { backgroundColor: "#111" },
  chipText: { fontSize: 12 },
  chipTextActive: { color: "#fff" },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
});