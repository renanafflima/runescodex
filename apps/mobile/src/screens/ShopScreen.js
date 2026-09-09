import React, { useState } from "react";
import { FlatList, Pressable, Text, View, StyleSheet, Alert } from "react-native";
import { SHOP_ITEMS } from "../data/mock";
import { useAppStore } from "../store/AppStore";

export default function ShopScreen() {
  const { userId, points, redemptions, actions } = useAppStore();
  const [showHistory, setShowHistory] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shop</Text>
      <Text style={styles.sub}>Seu ID: {userId}</Text>
      <Text style={styles.points}>Pontos: {points}</Text>

      <View style={styles.row}>
        <Pressable style={styles.toggle} onPress={() => setShowHistory(false)}>
          <Text style={[styles.toggleText, !showHistory && styles.toggleTextActive]}>Itens</Text>
        </Pressable>
        <Pressable style={styles.toggle} onPress={() => setShowHistory(true)}>
          <Text style={[styles.toggleText, showHistory && styles.toggleTextActive]}>Histórico</Text>
        </Pressable>
      </View>

      {!showHistory ? (
        <FlatList
          data={SHOP_ITEMS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={{ opacity: 0.8 }}>{item.description}</Text>
              <Text style={styles.cost}>Custo: {item.cost} pontos</Text>

              <Pressable
                style={[styles.btn, points < item.cost && { opacity: 0.5 }]}
                onPress={() => {
                  if (points < item.cost) return;
                  Alert.alert(
                    "Confirmar resgate",
                    `Resgatar "${item.title}" por ${item.cost} pontos?`,
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Resgatar",
                        onPress: () => {
                          const res = actions.redeem({ itemId: item.id, title: item.title, cost: item.cost });
                          Alert.alert(res.ok ? "Sucesso" : "Ops", res.message);
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.btnText}>Resgatar</Text>
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={{ opacity: 0.8 }}>Custo: {item.cost} pontos</Text>
              <Text style={{ opacity: 0.6, fontSize: 12 }}>Em: {new Date(item.createdAt).toLocaleString("pt-BR")}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ opacity: 0.7 }}>Nenhum resgate ainda.</Text>}
        />
      )}

      <Pressable
        style={[styles.resetBtn]}
        onPress={() => {
          Alert.alert("Resetar dados?", "Isso apaga pontos, fórum, chamados e histórico (mock).", [
            { text: "Cancelar", style: "cancel" },
            { text: "Resetar", style: "destructive", onPress: () => actions.resetAll() },
          ]);
        }}
      >
        <Text style={styles.resetText}>Resetar dados (dev)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { opacity: 0.7 },
  points: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  toggle: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  toggleText: { fontWeight: "700", opacity: 0.6 },
  toggleTextActive: { opacity: 1 },

  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cost: { marginTop: 4, fontWeight: "700" },
  btn: { backgroundColor: "#111", padding: 12, borderRadius: 12, alignItems: "center", marginTop: 6 },
  btnText: { color: "#fff", fontWeight: "700" },

  resetBtn: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  resetText: { fontWeight: "700" },
});