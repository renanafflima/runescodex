import React, { useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { SERVICEIROS } from "@/src/data/community";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import EmptyState from "@/components/ui/EmptyState";

function renderStars(rating) {
  const rounded = Math.round(rating);
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

export default function ServicesScreen() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const data = useMemo(() => {
    const term = search.trim().toLowerCase();
    return SERVICEIROS.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.vocation.toLowerCase().includes(term) ||
        item.specialties.join(" ").toLowerCase().includes(term)
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
            <Text style={styles.title}>{t("services.title")}</Text>
            <Text style={styles.subtitle}>{t("services.subtitle")}</Text>
            <TextInput
              style={styles.input}
              value={search}
              onChangeText={setSearch}
              placeholder={t("services.search")}
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
                <Text style={styles.body}>{item.description}</Text>
                <Text style={styles.meta}>
                  {t("services.vocation")}: {item.vocation} • {item.online ? t("services.online") : t("services.offline")}
                </Text>
                <Text style={styles.meta}>
                  {renderStars(item.rating)} • {item.priceTcHour} TC/h • {item.completedServices}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{t("services.comments")}</Text>
            {item.comments.map((comment) => (
              <View key={comment.id} style={styles.comment}>
                <Text style={styles.commentUser}>{comment.user} {renderStars(comment.rating)}</Text>
                <Text style={styles.body}>{comment.comment}</Text>
              </View>
            ))}
          </AppCard>
        )}
        ListEmptyComponent={<EmptyState title={t("services.empty")} />}
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
  meta: { color: Colors.textMuted, fontSize: Type.tiny, marginTop: 4 },
  row: { flexDirection: "row", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.bgSecondary },
  comment: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
  },
  commentUser: { color: Colors.text, fontWeight: "800", fontSize: Type.secondary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    color: Colors.text,
  },
});
