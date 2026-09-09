import React, { useMemo, useState } from "react";
import { FlatList, Image, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { STREAMERS } from "@/src/data/community";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import EmptyState from "@/components/ui/EmptyState";

export default function StreamersScreen() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    const term = search.trim().toLowerCase();
    return STREAMERS.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.tags.join(" ").toLowerCase().includes(term)
      );
    }).sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  }, [search]);

  return (
    <AppScreen>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>{t("streamers.title")}</Text>
            <Text style={styles.subtitle}>{t("streamers.subtitle")}</Text>
            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder={t("streamers.search")}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        }
        renderItem={({ item }) => (
          <AppCard>
            <View style={styles.row}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.featured ? <Text style={styles.gold}>{t("common.featured")}</Text> : null}
                <Text style={styles.body}>{item.description}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {item.youtube ? (
                <AppButton label="YouTube" variant="secondary" onPress={() => Linking.openURL(item.youtube)} />
              ) : null}
              {item.twitch ? (
                <AppButton label="Twitch" variant="ghost" onPress={() => Linking.openURL(item.twitch)} />
              ) : null}
            </View>
          </AppCard>
        )}
        ListEmptyComponent={<EmptyState title={t("streamers.empty")} />}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 12, paddingBottom: 28 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary },
  cardTitle: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  body: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18, marginTop: 4 },
  gold: { color: Colors.goldLight, fontSize: Type.tiny, fontWeight: "800", marginTop: 2 },
  row: { flexDirection: "row", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bgSecondary },
  actions: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
  },
});
