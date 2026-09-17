import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";

const youtubeIcon = require("../../assets/ui/youtube.png");
const bestiaryBg = require("@/assets/runescodex/bestiary/bestiario_background.webp");

const DIFFS = ["All", "Easy", "Medium", "Hard", "Very Hard"];

async function openUrl(url) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // ignore
  }
}

// Imagens das criaturas
const CREATURES = [
  {
    id: "c1",
    name: "Cyclops",
    image: require("@/assets/runescodex/creatures/Cyclops.gif"),
    difficulty: "Easy",
    location: "Cyclops Cave",
    region: "Thais",
    hp: 260,
    killTogether: ["Cyclops Smith", "Cyclops Drone"],
    bestiaryKills: 500,
    killsPerHour: 260,
    recommendedLevel: 25,
    vocation: "Any",
    weaknesses: ["Physical", "Energy"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+cyclops+hunt",
  },
  {
    id: "c2",
    name: "Dragon",
    image: require("@/assets/runescodex/creatures/Dragon.gif"),
    difficulty: "Medium",
    location: "Darashia - Dragon Lair",
    region: "Desert",
    hp: 1000,
    killTogether: ["Dragon Hatchling", "Dragon Lord Hatchling"],
    bestiaryKills: 1000,
    killsPerHour: 180,
    recommendedLevel: 60,
    vocation: "Any",
    weaknesses: ["Ice"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+dragon+hunt",
  },
  {
    id: "c3",
    name: "Hydra",
    image: require("@/assets/runescodex/creatures/Hydra.gif"),
    difficulty: "Hard",
    location: "Tiquanda - Hydra Cave",
    region: "Jungle",
    hp: 2350,
    killTogether: ["Serpent Spawn", "Medusa"],
    bestiaryKills: 1000,
    killsPerHour: 110,
    recommendedLevel: 150,
    vocation: "EK",
    weaknesses: ["Ice", "Energy"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+hydra+hunt",
  },
  {
    id: "c4",
    name: "Demon",
    image: require("@/assets/runescodex/creatures/Demon.gif"),
    difficulty: "Very Hard",
    location: "Edron - Demon Pits",
    region: "Hell",
    hp: 8200,
    killTogether: ["Hellhound", "Fire Elemental"],
    bestiaryKills: 1000,
    killsPerHour: 55,
    recommendedLevel: 250,
    vocation: "Any",
    weaknesses: ["Holy", "Ice"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+demon+hunt",
  },
];

export default function BestiaryScreen() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState("All");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return CREATURES.filter((c) => {
      const matchDiff = difficulty === "All" || c.difficulty === difficulty;
      const matchQ =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.location.toLowerCase().includes(query) ||
        c.region.toLowerCase().includes(query) ||
        (c.killTogether || []).some((name) => String(name).toLowerCase().includes(query));
      return matchDiff && matchQ;
    });
  }, [q, difficulty]);

  return (
    <AppScreen>
      <ImageBackground source={bestiaryBg} resizeMode="cover" style={styles.bg}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <View style={styles.header}>
                <Text style={styles.title}>{t("bestiary.title")}</Text>
                <Text style={styles.subtitle}>{t("bestiary.subtitle")}</Text>
              </View>

              <View style={styles.searchRow}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t("bestiary.search")}
                  placeholderTextColor="rgba(231,231,221,0.55)"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.filterLabel}>{t("bestiary.difficulty")}</Text>
              <View style={styles.chipsRow}>
                {DIFFS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[styles.chip, difficulty === d && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
                      {d === "All" ? t("common.all") : d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{t("bestiary.empty")}</Text>
          }
          renderItem={({ item }) => {
            const hours = Math.max(1, Math.ceil(item.bestiaryKills / item.killsPerHour));
            return (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Image source={item.image} style={styles.avatar} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.difficulty} • {item.vocation} • Lvl {item.recommendedLevel}
                    </Text>
                    <Text style={styles.meta}>
                      {t("bestiary.where")}: {item.location} ({item.region})
                    </Text>
                  </View>
                  <Pressable onPress={() => openUrl(item.youtubeUrl)} style={styles.ytBtn}>
                    <Image source={youtubeIcon} style={styles.ytIcon} resizeMode="contain" />
                  </Pressable>
                </View>
                <Text style={styles.meta}>
                  {t("bestiary.together")}: {(item.killTogether || []).join(", ")}
                </Text>
                <Text style={styles.meta}>
                  {t("bestiary.weaknesses")}: {(item.weaknesses || []).join(", ")}
                </Text>
                <Text style={styles.meta}>
                  {t("bestiary.kills", { kills: item.bestiaryKills, kph: item.killsPerHour })}
                </Text>
                <Text style={styles.meta}>
                  {t("bestiary.time")}: ~{hours}h • HP {item.hp}
                </Text>
              </View>
            );
          }}
        />
      </ImageBackground>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  headerWrap: { padding: 16, gap: 12 },
  listContent: { paddingBottom: 24 },
  header: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 12, 35, 0.50)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: COLORS.muted || COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { color: COLORS.textMuted || COLORS.textSecondary, fontSize: 16 },
  searchInput: { flex: 1, color: COLORS.text, fontWeight: "700" },
  filterLabel: { color: COLORS.text, fontWeight: "800" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "rgba(212,167,44,0.18)" },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: COLORS.goldLight || COLORS.gold },
  empty: { color: COLORS.textSecondary, marginTop: 12, paddingHorizontal: 16 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 56, height: 56 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  meta: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  ytBtn: { padding: 6 },
  ytIcon: { width: 20, height: 20 },
});