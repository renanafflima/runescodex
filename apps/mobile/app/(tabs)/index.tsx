import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const appIcon = require("@/assets/ui/runescodex-icon.png");

const FEATURED_HUNTS = [
  {
    id: "h2",
    name: "Dragon Hunt",
    xpH: "450.000",
    profitH: "60.000",
    levelMin: 80,
    vocation: "MS",
    difficulty: "Medium",
    creatures: "Dragon",
  },
  {
    id: "h3",
    name: "Hydra Hunt",
    xpH: "900.000",
    profitH: "120.000",
    levelMin: 150,
    vocation: "RP",
    difficulty: "Hard",
    creatures: "Hydra",
  },
];

export default function HomeTab() {
  const router = useRouter();
  const { userId, points } = useAppStore();
  const { t } = useI18n();

  const shortcuts = [
    { key: "bestiary", icon: "paw-outline" as const, path: "/(tabs)/bestiary" },
    { key: "services", icon: "construct-outline" as const, path: "/(tabs)/services" },
    { key: "streamers", icon: "videocam-outline" as const, path: "/(tabs)/streamers" },
    { key: "music", icon: "musical-notes-outline" as const, path: "/(tabs)/music" },
    { key: "store", icon: "storefront-outline" as const, path: "/(tabs)/shop" },
    { key: "tickets", icon: "document-text-outline" as const, path: "/(tabs)/quest-board" },
  ];

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={appIcon} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("home.title")}</Text>
            <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
          </View>
        </View>

        <AppCard>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>{t("home.progress")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{t("home.active")}</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t("home.yourId")}</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {userId || "—"}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t("home.points")}</Text>
              <Text style={styles.points}>{points ?? 0}</Text>
            </View>
          </View>
        </AppCard>

        <Pressable onPress={() => router.push("/(tabs)/quest-board")} style={({ pressed }) => pressed && styles.pressed}>
          <AppCard elevated>
            <Text style={styles.kicker}>{t("home.promoTitle")}</Text>
            <Text style={styles.promoText}>{t("home.promoSubtitle")}</Text>
            <Text style={styles.link}>{t("home.promoCta")} ›</Text>
          </AppCard>
        </Pressable>

        <Text style={styles.section}>{t("home.quickMenu")}</Text>
        <View style={styles.grid}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.path as any)}
              style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={item.icon} size={18} color={Colors.goldLight} />
              </View>
              <Text style={styles.quickTitle}>{t(`home.${item.key}`)}</Text>
              <Text style={styles.quickDesc}>{t(`home.${item.key}Desc`)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>{t("home.featuredHunts")}</Text>
        {FEATURED_HUNTS.map((hunt) => (
          <AppCard key={hunt.id}>
            <Text style={styles.cardTitle}>{hunt.name}</Text>
            <Text style={styles.muted}>
              {hunt.creatures} • {hunt.vocation} • {hunt.difficulty}
            </Text>
            <View style={styles.metaRow}>
              <Meta label="XP/h" value={hunt.xpH} />
              <Meta label="Profit/h" value={hunt.profitH} />
              <Meta label="Lvl" value={String(hunt.levelMin)} />
            </View>
            <AppButton label={t("home.openHunt")} onPress={() => router.push("/(tabs)/hunts")} />
          </AppCard>
        ))}

        <AppCard>
          <Text style={styles.cardTitle}>{t("home.tritechTitle")}</Text>
          <Text style={styles.muted}>{t("home.tritechBody")}</Text>
          <Text style={styles.linkMuted}>{t("home.tritechCta")}</Text>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 14, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, marginTop: 4, fontSize: Type.secondary, lineHeight: 18 },
  section: { color: Colors.text, fontSize: Type.section, fontWeight: "800" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.bgSecondary,
  },
  pillText: { color: Colors.textSecondary, fontSize: Type.tiny, fontWeight: "700" },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    gap: 4,
  },
  statLabel: { color: Colors.textMuted, fontSize: Type.tiny, fontWeight: "700" },
  statValue: { color: Colors.text, fontWeight: "700", fontSize: Type.secondary },
  points: { color: Colors.goldLight, fontSize: 22, fontWeight: "800" },
  kicker: { color: Colors.gold, fontSize: Type.tiny, fontWeight: "800", letterSpacing: 0.4 },
  promoText: { color: Colors.text, fontSize: Type.body, lineHeight: 20 },
  link: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.secondary },
  linkMuted: { color: Colors.textMuted, fontWeight: "700", fontSize: Type.secondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickItem: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 12,
    minHeight: 96,
    gap: 6,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(212,167,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.card },
  quickDesc: { color: Colors.textMuted, fontSize: Type.tiny },
  cardTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.card },
  muted: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  meta: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  metaValue: { color: Colors.text, fontSize: Type.secondary, fontWeight: "800" },
  pressed: { opacity: 0.92 },
});
