import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "@/src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppChip from "@/components/ui/AppChip";

export default function ProfileScreen() {
  const router = useRouter();
  const { userId, points, redemptions, quests } = useAppStore();
  const { t, locale, setLocale, locales } = useI18n();

  const openTickets = (quests || []).filter((q) => q.status === "open").length;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RC</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("profile.title")}</Text>
            <Text style={styles.subtitle}>{t("profile.subtitle")}</Text>
          </View>
        </View>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.account")}</Text>
          <Text style={styles.meta}>{t("home.yourId")}: {userId}</Text>
          <View style={styles.stats}>
            <Stat label={t("profile.points")} value={String(points ?? 0)} />
            <Stat label={t("profile.redemptions")} value={String((redemptions || []).length)} />
            <Stat label={t("profile.openTickets")} value={String(openTickets)} />
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.language")}</Text>
          <View style={styles.row}>
            {locales.map((item) => (
              <AppChip
                key={item.id}
                label={item.label}
                active={locale === item.id}
                onPress={() => setLocale(item.id)}
              />
            ))}
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.rewards")}</Text>
          {(redemptions || []).length === 0 ? (
            <Text style={styles.subtitle}>{t("profile.noRewards")}</Text>
          ) : (
            (redemptions || []).slice(0, 5).map((item) => (
              <View key={item.id} style={styles.reward}>
                <Text style={styles.rewardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.cost} pts</Text>
              </View>
            ))
          )}
          <AppButton label={t("profile.goStore")} onPress={() => router.push("/(tabs)/shop")} />
          <AppButton
            label={t("profile.goTickets")}
            variant="secondary"
            onPress={() => router.push("/(tabs)/quest-board")}
          />
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 14, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(212,167,44,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.goldLight, fontWeight: "800" },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  cardTitle: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  meta: { color: Colors.textMuted, fontSize: Type.tiny },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
  },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  statValue: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.card, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reward: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
  },
  rewardTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.body },
});
