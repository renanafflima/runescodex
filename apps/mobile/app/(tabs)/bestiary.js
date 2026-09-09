import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  ScrollView,
  Modal,
  Image,
  Linking,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";

// ✅ Ícone local do YouTube
const youtubeIcon = require("../../assets/ui/youtube.png");

// ✅ Background
const bestiaryBg = require("@/assets/ui/bestiario.png")
// ✅ Mapas
const MAPS = {
  Cyclops: require("@/assets/maps/cyclops.png"),
  Dragon: require("@/assets/maps/dragon.png"),
  Hydra: require("@/assets/maps/hydra.png"),
  Demon: require("@/assets/maps/demon.png"),
};

const CREATURES = [
  {
    id: "c1",
    name: "Cyclops",
    image: require("@/assets/criatures/cyclops.gif"),
    difficulty: "Easy",
    location: "Cyclops Cave",
    region: "Thais",
    hp: 260,
    killTogether: [
      {
        name: "Cyclops Smith",
        image: require("@/assets/criatures/cyclops-smith.gif"),
      },
      {
        name: "Cyclops Drone",
        image: require("@/assets/criatures/cyclops-drone.gif"),
      },
    ],
    bestiaryKills: 500,
    killsPerHour: 260,
    recommendedLevel: "25+",
    vocation: "Any",
    weaknesses: ["Physical", "Energy"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+cyclops+spawn",
  },
  {
    id: "c2",
    name: "Dragon",
    image: require("@/assets/criatures/dragon.gif"),
    difficulty: "Medium",
    location: "Darashia - Dragon Lair",
    region: "Desert",
    hp: 1000,
    killTogether: [
      {
        name: "Dragon Hatchling",
        image: require("@/assets/criatures/dragon-hatchling.gif"),
      },
      {
        name: "Dragon Lord Hatchling",
        image: require("@/assets/criatures/dragon-lord-hatchling.gif"),
      },
    ],
    bestiaryKills: 1000,
    killsPerHour: 180,
    recommendedLevel: "60+",
    vocation: "Any",
    weaknesses: ["Ice"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+dragon+spawn",
  },
  {
    id: "c3",
    name: "Hydra",
    image: require("@/assets/criatures/hydra.gif"),
    difficulty: "Hard",
    location: "Tiquanda - Hydra Cave",
    region: "Jungle",
    hp: 2350,
    killTogether: [
      {
        name: "Serpent Spawn",
        image: require("@/assets/criatures/serpent-spawn.gif"),
      },
      {
        name: "Medusa",
        image: require("@/assets/criatures/medusa.gif"),
      },
    ],
    bestiaryKills: 1000,
    killsPerHour: 110,
    recommendedLevel: "150+",
    vocation: "EK",
    weaknesses: ["Ice", "Energy"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+hydra+spawn",
  },
  {
    id: "c4",
    name: "Demon",
    image: require("@/assets/criatures/demon.gif"),
    difficulty: "Very Hard",
    location: "Edron - Demon Pits",
    region: "Hell",
    hp: 8200,
    killTogether: [
      {
        name: "Hellhound",
        image: require("@/assets/criatures/hellhound.gif"),
      },
      {
        name: "Fire Elemental",
        image: require("@/assets/criatures/fire-elemental.gif"),
      },
    ],
    bestiaryKills: 1000,
    killsPerHour: 55,
    recommendedLevel: "250+",
    vocation: "Any",
    weaknesses: ["Holy", "Ice"],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+demon+spawn",
  },
];

const DIFFS = ["All", "Easy", "Medium", "Hard", "Very Hard"];
const REGIONS = ["All", "Mainland", "Desert", "Jungle", "Islands", "Hell"];
const VOCS = ["Any", "EK", "RP", "MS", "ED"];
const SORTS = ["Time", "Difficulty", "HP", "Name"];

const DIFF_WEIGHT = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
  "Very Hard": 4,
};

export default function BestiaryScreen() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [region, setRegion] = useState("All");
  const [vocation, setVocation] = useState("Any");
  const [withOthers, setWithOthers] = useState(false);
  const [sortBy, setSortBy] = useState("Time");
  const [mapCreature, setMapCreature] = useState(null);

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.06],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.32],
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    let arr = CREATURES.filter((c) => {
      const matchQ =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.location.toLowerCase().includes(query) ||
        (c.killTogether || []).some((k) => String(k.name).toLowerCase().includes(query));

      const matchDiff = difficulty === "All" ? true : c.difficulty === difficulty;
      const matchRegion = region === "All" ? true : c.region === region;
      const matchVoc = vocation === "Any" ? true : c.vocation === vocation || c.vocation === "Any";
      const matchWith = withOthers ? (c.killTogether || []).length > 0 : true;

      return matchQ && matchDiff && matchRegion && matchVoc && matchWith;
    });

    arr = [...arr].sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "HP") return b.hp - a.hp;
      if (sortBy === "Difficulty") return DIFF_WEIGHT[b.difficulty] - DIFF_WEIGHT[a.difficulty];
      return getTimeMin(a) - getTimeMin(b);
    });

    return arr;
  }, [q, difficulty, region, vocation, withOthers, sortBy]);

  async function openUrl(url) {
    try {
      if (!url) return;
      const can = await Linking.canOpenURL(url);
      if (!can) return;
      await Linking.openURL(url);
    } catch {}
  }

  const selectedMap = mapCreature ? MAPS[mapCreature.name] : null;

  return (
    <AppScreen>
      <ImageBackground source={bestiaryBg} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.72)",
            "rgba(0,0,0,0.28)",
            "rgba(0,0,0,0.84)",
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <CreatureCard
              item={item}
              onOpenMap={() => setMapCreature(item)}
              onOpenYoutube={() => openUrl(item.youtubeUrl)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <View style={styles.header}>
                <Text style={styles.title}>{t("bestiary.title")}</Text>
                <Text style={styles.subtitle}>{t("bestiary.subtitle")}</Text>

                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.glowOrb,
                    { opacity: glowOpacity, transform: [{ scale: glowScale }] },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(109,120,225,0.0)",
                      "rgba(109,120,225,0.55)",
                      "rgba(217,146,84,0.35)",
                    ]}
                    start={{ x: 0.2, y: 0.2 }}
                    end={{ x: 0.8, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
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
                {!!q && (
                  <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
                    <Text style={styles.clearText}>✕</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{t("common.filters")}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{t("common.results", { count: filtered.length })}</Text>
                  </View>
                </View>

                <Text style={styles.filterLabel}>{t("bestiary.difficulty")}</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.diffRow}
                >
                  {DIFFS.map((d) => (
                    <Chip
                      key={d}
                      label={d}
                      active={difficulty === d}
                      onPress={() => setDifficulty(d)}
                    />
                  ))}
                </ScrollView>

                <Text style={styles.filterLabel}>{t("bestiary.region")}</Text>
                <View style={styles.chipsRow}>
                  {REGIONS.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      active={region === r}
                      onPress={() => setRegion(r)}
                    />
                  ))}
                </View>

                <Text style={styles.filterLabel}>{t("bestiary.vocation")}</Text>
                <View style={styles.chipsRow}>
                  {VOCS.map((v) => (
                    <Chip
                      key={v}
                      label={v}
                      active={vocation === v}
                      onPress={() => setVocation(v)}
                    />
                  ))}
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.filterLabel}>{t("bestiary.withOthers")}</Text>
                  <Pressable
                    onPress={() => setWithOthers((s) => !s)}
                    style={[styles.toggle, withOthers && styles.toggleOn]}
                  >
                    <View style={[styles.knob, withOthers && styles.knobOn]} />
                  </Pressable>
                </View>

                <Text style={styles.filterLabel}>{t("bestiary.sort")}</Text>
                <View style={styles.chipsRow}>
                  {SORTS.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      active={sortBy === s}
                      onPress={() => setSortBy(s)}
                    />
                  ))}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: COLORS.muted, marginTop: 12, paddingHorizontal: 16 }}>
              {t("bestiary.empty")}
            </Text>
          }
        />

        <Modal
          visible={!!mapCreature}
          transparent
          animationType="fade"
          onRequestClose={() => setMapCreature(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {mapCreature?.name || "Mapa"} — Localização
                </Text>

                <Pressable onPress={() => setMapCreature(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>{t("common.close")}</Text>
                </Pressable>
              </View>

              {selectedMap ? (
                <Image source={selectedMap} style={styles.mapImage} resizeMode="cover" />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                    Mapa ainda não configurado
                  </Text>
                  <Text style={{ color: COLORS.muted, marginTop: 6, lineHeight: 18 }}>
                    Crie a imagem do mapa e coloque em:
                  </Text>
                  <Text style={{ color: COLORS.text, fontWeight: "900", marginTop: 6 }}>
                    apps/mobile/assets/maps/{String(mapCreature?.name || "").toLowerCase()}.png
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => openUrl(mapCreature?.youtubeUrl)}
                style={styles.youtubeBigBtn}
              >
                <Image source={youtubeIcon} style={{ width: 20, height: 20 }} resizeMode="contain" />
                <Text style={styles.youtubeBigText}>{t("hunts.openYoutube")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ImageBackground>
    </AppScreen>
  );
}

function getTimeMin(c) {
  if (c.timeToCompleteMin && c.timeToCompleteMin > 0) return c.timeToCompleteMin;
  const hours = c.bestiaryKills / Math.max(1, c.killsPerHour);
  return Math.round(hours * 60);
}

function formatTime(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function diffBadge(d) {
  const map = {
    Easy: {
      bg: "rgba(109,120,225,0.12)",
      border: "rgba(109,120,225,0.32)",
      text: COLORS.text,
    },
    Medium: {
      bg: "rgba(43,58,184,0.18)",
      border: "rgba(43,58,184,0.35)",
      text: COLORS.text,
    },
    Hard: {
      bg: "rgba(217,146,84,0.12)",
      border: "rgba(217,146,84,0.35)",
      text: COLORS.gold,
    },
    "Very Hard": {
      bg: "rgba(217,146,84,0.14)",
      border: "rgba(217,146,84,0.45)",
      text: COLORS.gold,
    },
  };
  return map[d] || map.Easy;
}

function CreatureCard({ item, onOpenMap, onOpenYoutube }) {
  const { t } = useI18n();
  const timeMin = getTimeMin(item);
  const badge = diffBadge(item.difficulty);

  return (
    <View style={[styles.card, styles.creatureCard]}>
      <View style={styles.rowBetween}>
        <View style={styles.nameRow}>
          <Image source={item.image} style={styles.creatureAvatar} resizeMode="contain" />

          <View style={styles.nameContent}>
            <View style={styles.nameTopRow}>
              <Text style={styles.creatureName}>{item.name}</Text>

              <Pressable onPress={onOpenMap} style={styles.iconBtn} hitSlop={8}>
                <Text style={styles.iconBtnText}>⌖</Text>
              </Pressable>

              <Pressable onPress={onOpenYoutube} style={[styles.iconBtn, styles.youtubeBtn]} hitSlop={8}>
                <Image source={youtubeIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{item.difficulty}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Meta label="HP" value={String(item.hp)} />
        <Meta label="Lvl" value={item.recommendedLevel} />
        <Meta label="Voc" value={item.vocation} />
        <Meta label={t("bestiary.time")} value={formatTime(timeMin)} highlight />
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>{t("bestiary.where")}</Text>
        <Text style={styles.infoText}>{item.location}</Text>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>{t("bestiary.together")}</Text>

        {item.killTogether && item.killTogether.length ? (
          <View style={styles.killTogetherWrap}>
            {item.killTogether.map((monster) => (
              <View key={monster.name} style={styles.killTogetherItem}>
                <Image
                  source={monster.image}
                  style={styles.killTogetherAvatar}
                  resizeMode="contain"
                />
                <Text style={styles.killTogetherText}>{monster.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.infoText}>—</Text>
        )}
      </View>

      <View style={styles.infoBlockRow}>
        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>{t("bestiary.completion")}</Text>
          <Text style={styles.infoText}>
            {t("bestiary.kills", { kills: item.bestiaryKills, kph: item.killsPerHour })}
          </Text>
        </View>

        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>{t("bestiary.weaknesses")}</Text>
          <Text style={styles.infoText}>{(item.weaknesses || []).join(" • ")}</Text>
        </View>
      </View>
    </View>
  );
}

function Meta({ label, value, highlight }) {
  return (
    <View style={[styles.metaPill, highlight && styles.metaPillHighlight]}>
      <Text style={[styles.metaLabel, highlight && { color: COLORS.gold }]}>{label}</Text>
      <Text style={[styles.metaValue, highlight && { color: COLORS.gold }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={
          active
            ? ["rgba(217,146,84,0.20)", "rgba(43,58,184,0.18)"]
            : ["rgba(109,120,225,0.14)", "rgba(43,58,184,0.10)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg0,
  },
  bg: {
    flex: 1,
  },
  headerWrap: {
    padding: 16,
    gap: 12,
  },
  listContent: {
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    position: "relative",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255, 9, 124, 0.5)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  glowOrb: {
    position: "absolute",
    right: -40,
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 999,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 18,
  },
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
  searchIcon: {
    color: COLORS.muted,
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.28)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  clearText: {
    color: COLORS.muted,
    fontWeight: "900",
  },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
    }),
  },
  creatureCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(15, 12, 35, 0.68)",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  creatureAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.28)",
    backgroundColor: "rgba(9, 7, 30, 0.40)",
  },
  nameContent: {
    flex: 1,
  },
  nameTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(109,120,225,0.10)",
  },
  pillText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },
  filterLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  diffRow: {
    gap: 8,
    paddingRight: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  chipActive: {
    borderColor: "rgba(217,146,84,0.45)",
  },
  chipText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: {
    borderColor: "rgba(217,146,84,0.45)",
    backgroundColor: "rgba(217,146,84,0.12)",
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(231,231,221,0.75)",
    transform: [{ translateX: 0 }],
  },
  knobOn: {
    backgroundColor: COLORS.gold,
    transform: [{ translateX: 18 }],
  },
  creatureName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  metaPillHighlight: {
    borderColor: "rgba(217,146,84,0.40)",
    backgroundColor: "rgba(217,146,84,0.10)",
  },
  metaLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },
  metaValue: {
    color: COLORS.text,
    fontWeight: "900",
  },
  infoBlock: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
    gap: 6,
  },
  infoBlockRow: {
    flexDirection: "row",
    gap: 10,
  },
  infoTitle: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  infoText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 18,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginTop: -1,
  },
  youtubeBtn: {
    borderColor: "rgba(217,146,84,0.35)",
    backgroundColor: "rgba(217,146,84,0.10)",
  },
  killTogetherWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  killTogetherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.20)",
    backgroundColor: "rgba(9, 7, 30, 0.25)",
  },
  killTogetherAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  killTogetherText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 16,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(15, 12, 35, 0.92)",
    padding: 14,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
  },
  modalCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  modalCloseText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  mapImage: {
    width: "100%",
    height: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
  },
  mapPlaceholder: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
  },
  youtubeBigBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,146,84,0.45)",
    backgroundColor: "rgba(217,146,84,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  youtubeBigText: {
    color: COLORS.text,
    fontWeight: "900",
  },
});