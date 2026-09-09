import React, { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View, StyleSheet } from "react-native";
import { HUNTS } from "../data/mock";

function toNumberOrNull(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function HuntsScreen() {
  const [name, setName] = useState("");
  const [creature, setCreature] = useState("");
  const [minXpH, setMinXpH] = useState("");
  const [minProfitH, setMinProfitH] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [vocation, setVocation] = useState("");

  const data = useMemo(() => {
    const xpN = toNumberOrNull(minXpH);
    const profN = toNumberOrNull(minProfitH);
    const lvlN = toNumberOrNull(minLevel);

    return HUNTS.filter((h) => {
      if (name && !h.name.toLowerCase().includes(name.toLowerCase())) return false;
      if (creature && !h.creature.toLowerCase().includes(creature.toLowerCase())) return false;
      if (vocation && h.vocation.toLowerCase() !== vocation.toLowerCase()) return false;
      if (xpN && h.xpH < xpN) return false;
      if (profN && h.profitH < profN) return false;
      if (lvlN && h.levelMin < lvlN) return false;
      return true;
    });
  }, [name, creature, minXpH, minProfitH, minLevel, vocation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hunts</Text>

      <View style={styles.form}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Filtrar por nome" />
        <TextInput style={styles.input} value={creature} onChangeText={setCreature} placeholder="Filtrar por criatura" />
        <TextInput style={styles.input} value={minXpH} onChangeText={setMinXpH} placeholder="XP/H mínimo" keyboardType="numeric" />
        <TextInput style={styles.input} value={minProfitH} onChangeText={setMinProfitH} placeholder="Profit/H mínimo" keyboardType="numeric" />
        <TextInput style={styles.input} value={minLevel} onChangeText={setMinLevel} placeholder="Level mínimo" keyboardType="numeric" />
        <TextInput style={styles.input} value={vocation} onChangeText={setVocation} placeholder="Profissão (EK/EM/MS/ED/RP)" autoCapitalize="characters" />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text>Criatura: {item.creature}</Text>
            <Text>XP/H: {item.xpH.toLocaleString("pt-BR")}</Text>
            <Text>Profit/H: {item.profitH.toLocaleString("pt-BR")}</Text>
            <Text>Level mínimo: {item.levelMin}</Text>
            <Text>Profissão: {item.vocation}</Text>
            <Text style={styles.rune}>Runa recomendada: {item.rune}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ opacity: 0.7 }}>Nenhuma hunt encontrada com esses filtros.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  form: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  rune: { marginTop: 6, fontWeight: "700" },
});