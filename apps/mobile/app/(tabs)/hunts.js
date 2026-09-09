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

// ✅ Background da tela Hunts
const huntsBg = require("@/assets/ui/hunts.png");

// ✅ Mapas locais
const MAPS = {
  Cyclops: require("../../assets/maps/cyclops.png"),
  Dragon: require("../../assets/maps/dragon.png"),
  Hydra: require("../../assets/maps/hydra.png"),
  Demon: require("../../assets/maps/demon.png"),
};

// ✅ Imagens das criaturas
const CREATURE_IMAGES = {
  Cyclops: require("@/assets/criatures/cyclops.gif"),
  "Cyclops Smith": require("@/assets/criatures/cyclops-smith.gif"),
  "Cyclops Drone": require("@/assets/criatures/cyclops-drone.gif"),

  Dragon: require("@/assets/criatures/dragon.gif"),
  "Dragon Hatchling": require("@/assets/criatures/dragon-hatchling.gif"),
  "Dragon Lord Hatchling": require("@/assets/criatures/dragon-lord-hatchling.gif"),

  Hydra: require("@/assets/criatures/hydra.gif"),
  "Serpent Spawn": require("@/assets/criatures/serpent-spawn.gif"),
  Medusa: require("@/assets/criatures/medusa.gif"),

  Demon: require("@/assets/criatures/demon.gif"),
  "Grim Reaper": require("@/assets/criatures/grim-reaper.gif"),
  Hellhound: require("@/assets/criatures/hellhound.gif"),
};

const HUNTS = [
  {
    id: "h1",
    name: "Cyclops Hunt",
    creature: "Cyclops",
    creatureImage: CREATURE_IMAGES.Cyclops,
    location: "Thais - Cyclops Cave",
    xpH: 180000,
    profitH: 30000,
    levelMin: 40,
    vocation: "EK",
    recommendedDamage: "Physical / Energy (arma + suporte)",
    spawn: [
      {
        name: "Cyclops",
        image: CREATURE_IMAGES.Cyclops,
        weaknesses: ["Physical", "Energy"],
      },
      {
        name: "Cyclops Smith",
        image: CREATURE_IMAGES["Cyclops Smith"],
        weaknesses: ["Physical"],
      },
      {
        name: "Cyclops Drone",
        image: CREATURE_IMAGES["Cyclops Drone"],
        weaknesses: ["Physical"],
      },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+cyclops+hunt",
  },
  {
    id: "h2",
    name: "Dragon Hunt",
    creature: "Dragon",
    creatureImage: CREATURE_IMAGES.Dragon,
    location: "Darashia - Dragon Lair",
    xpH: 450000,
    profitH: 60000,
    levelMin: 80,
    vocation: "MS",
    recommendedDamage: "Ice / Physical (Avalanche/SD conforme voc)",
    spawn: [
      {
        name: "Dragon",
        image: CREATURE_IMAGES.Dragon,
        weaknesses: ["Ice"],
      },
      {
        name: "Dragon Hatchling",
        image: CREATURE_IMAGES["Dragon Hatchling"],
        weaknesses: ["Ice"],
      },
      {
        name: "Dragon Lord Hatchling",
        image: CREATURE_IMAGES["Dragon Lord Hatchling"],
        weaknesses: ["Ice"],
      },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+dragon+hunt",
  },
  {
    id: "h3",
    name: "Hydra Hunt",
    creature: "Hydra",
    creatureImage: CREATURE_IMAGES.Hydra,
    location: "Tiquanda - Hydra Cave",
    xpH: 900000,
    profitH: 120000,
    levelMin: 150,
    vocation: "RP",
    recommendedDamage: "Ice / Energy (Avalanche/GFB + set)",
    spawn: [
      {
        name: "Hydra",
        image: CREATURE_IMAGES.Hydra,
        weaknesses: ["Ice", "Energy"],
      },
      {
        name: "Serpent Spawn",
        image: CREATURE_IMAGES["Serpent Spawn"],
        weaknesses: ["Ice"],
      },
      {
        name: "Medusa",
        image: CREATURE_IMAGES.Medusa,
        weaknesses: ["Energy"],
      },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+hydra+hunt",
  },
  {
    id: "h4",
    name: "Demon Hunt",
    creature: "Demon",
    creatureImage: CREATURE_IMAGES.Demon,
    location: "Edron - Demon Pits",
    xpH: 1200000,
    profitH: 180000,
    levelMin: 250,
    vocation: "ED",
    recommendedDamage: "Holy / Ice (SD + suporte)",
    spawn: [
      {
        name: "Demon",
        image: CREATURE_IMAGES.Demon,
        weaknesses: ["Holy", "Ice"],
        bestCharm: "Freeze",
      },
      {
        name: "Grim Reaper",
        image: CREATURE_IMAGES["Grim Reaper"],
        weaknesses: ["Energy"],
        bestCharm: "Zap",
      },
      {
        name: "Hellhound",
        image: CREATURE_IMAGES.Hellhound,
        weaknesses: ["Ice"],
      },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=tibia+demon+hunt",
  },
];

const VOCS = ["Any", "EK", "RP", "MS", "ED"];
const PTS = [1, 2, 3, 4];
const SORTS = ["Best XP", "Best Profit", "Level", "Name"];

function toNumberOrNull(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatBR(n) {
  return n.toLocaleString("pt-BR");
}

function clampPT(n) {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}

function bestCharmFromWeakness(ws) {
  const w = (ws && ws[0]) || "Unknown";
  const map = {
    Ice: "Freeze",
    Energy: "Zap",
    Fire: "Enflame",
    Earth: "Poison",
    Holy: "Divine Wrath",
    Death: "Curse",
    Physical: "Wound",
    Unknown: "Low Blow",
  };
  return map[w] || "Low Blow";
}

async function openUrl(url) {
  try {
    if (!url) return;
    const can = await Linking.canOpenURL(url);
    if (!can) return;
    await Linking.openURL(url);
  } catch {
      // ignore
  }
}

export default function HuntsScreen() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [vocation, setVocation] = useState("Any");
  const [minXpH, setMinXpH] = useState("");
  const [minProfitH, setMinProfitH] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [pt, setPt] = useState(1);
  const [applyPt, setApplyPt] = useState(true);
  const [sortBy, setSortBy] = useState("Best XP");
  const [mapHunt, setMapHunt] = useState(null);

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

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.32] });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const xpN = toNumberOrNull(minXpH);
    const profN = toNumberOrNull(minProfitH);
    const lvlN = toNumberOrNull(minLevel);

    const mult = applyPt ? pt : 1;

    let arr = HUNTS.filter((h) => {
      const matchQ =
        !query ||
        h.name.toLowerCase().includes(query) ||
        h.creature.toLowerCase().includes(query) ||
        h.location.toLowerCase().includes(query) ||
        (h.spawn || []).some((s) => String(s.name).toLowerCase().includes(query));

      const matchVoc = vocation === "Any" ? true : h.vocation === vocation;
      const matchXp = xpN ? h.xpH * mult >= xpN : true;
      const matchProfit = profN ? h.profitH * mult >= profN : true;
      const matchLvl = lvlN ? h.levelMin >= lvlN : true;

      return matchQ && matchVoc && matchXp && matchProfit && matchLvl;
    });

    arr = [...arr].sort((a, b) => {
      const axp = a.xpH * mult;
      const bxp = b.xpH * mult;
      const aprof = a.profitH * mult;
      const bprof = b.profitH * mult;

      if (sortBy === "Best XP") return bxp - axp;
      if (sortBy === "Best Profit") return bprof - aprof;
      if (sortBy === "Level") return a.levelMin - b.levelMin;
      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [q, vocation, minXpH, minProfitH, minLevel, pt, applyPt, sortBy]);

  const selectedMap = mapHunt ? MAPS[mapHunt.creature] : null;

  return (
    <AppScreen>
      <ImageBackground source={huntsBg} resizeMode="cover" style={styles.bg}>
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
            <HuntCard
              item={item}
              pt={applyPt ? pt : 1}
              showPt={applyPt}
              onOpenMap={() => setMapHunt(item)}
              onOpenYoutube={() => openUrl(item.youtubeUrl)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <View style={styles.header}>
                <Text style={styles.title}>{t("hunts.title")}</Text>
                <Text style={styles.subtitle}>{t("hunts.subtitle")}</Text>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.glowOrb, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
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
                  placeholder={t("hunts.search")}
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

                <Text style={styles.filterLabel}>{t("hunts.vocation")}</Text>
                <View style={styles.chipsRow}>
                  {VOCS.map((v) => (
                    <Chip key={v} label={v} active={vocation === v} onPress={() => setVocation(v)} />
                  ))}
                </View>

                <View style={styles.rowBetween}>
                  <Text style={styles.filterLabel}>{t("hunts.applyPt")}</Text>
                  <Pressable
                    onPress={() => setApplyPt((s) => !s)}
                    style={[styles.toggle, applyPt && styles.toggleOn]}
                  >
                    <View style={[styles.knob, applyPt && styles.knobOn]} />
                  </Pressable>
                </View>

                <Text style={styles.filterLabel}>{t("hunts.ptLabel")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diffRow}>
                  {PTS.map((m) => (
                    <Chip key={m} label={`x${m}`} active={pt === m} onPress={() => setPt(clampPT(m))} />
                  ))}
                </ScrollView>

                <Text style={styles.filterLabel}>{t("hunts.mins")}</Text>
                <View style={styles.inputsGrid}>
                  <Input value={minLevel} onChangeText={setMinLevel} placeholder={t("hunts.minLevel")} keyboardType="numeric" />
                  <Input value={minXpH} onChangeText={setMinXpH} placeholder={t("hunts.minXp")} keyboardType="numeric" />
                  <Input value={minProfitH} onChangeText={setMinProfitH} placeholder={t("hunts.minProfit")} keyboardType="numeric" />
                </View>

                <Text style={styles.filterLabel}>{t("hunts.sort")}</Text>
                <View style={styles.chipsRow}>
                  {SORTS.map((s) => (
                    <Chip key={s} label={s} active={sortBy === s} onPress={() => setSortBy(s)} />
                  ))}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: COLORS.muted, marginTop: 12, paddingHorizontal: 16 }}>
              {t("hunts.empty")}
            </Text>
          }
        />

        <Modal
          visible={!!mapHunt}
          transparent
          animationType="fade"
          onRequestClose={() => setMapHunt(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {mapHunt?.creature || "Mapa"} — Localização
                </Text>

                <Pressable onPress={() => setMapHunt(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>{t("common.close")}</Text>
                </Pressable>
              </View>

              {selectedMap ? (
                <Image source={selectedMap} style={styles.mapImage} resizeMode="cover" />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>
                    Mapa não encontrado
                  </Text>
                  <Text style={{ color: COLORS.muted, marginTop: 6, lineHeight: 18 }}>
                    Coloque a imagem do mapa em:
                  </Text>
                  <Text style={{ color: COLORS.text, fontWeight: "900", marginTop: 6 }}>
                    apps/mobile/assets/maps/{String(mapHunt?.creature || "").toLowerCase()}.png
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => openUrl(mapHunt?.youtubeUrl)}
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

function HuntCard({ item, pt, showPt, onOpenMap, onOpenYoutube }) {
  const { t } = useI18n();
  const xp = item.xpH;
  const prof = item.profitH;

  const xpPT = xp * pt;
  const profPT = prof * pt;

  return (
    <View style={[styles.card, styles.huntCard]}>
      <View style={styles.rowBetween}>
        <View style={styles.huntHeaderLeft}>
          <Image source={item.creatureImage} style={styles.mainCreatureAvatar} resizeMode="contain" />

          <View style={{ flex: 1 }}>
            <View style={styles.huntNameRow}>
              <Text style={styles.creatureName}>{item.name}</Text>

              <Pressable onPress={onOpenMap} style={styles.iconBtn} hitSlop={8}>
                <Text style={styles.iconBtnText}>⌖</Text>
              </Pressable>

              <Pressable onPress={onOpenYoutube} style={[styles.iconBtn, styles.youtubeBtn]} hitSlop={8}>
                <Image source={youtubeIcon} style={{ width: 18, height: 18 }} resizeMode="contain" />
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              {item.creature} • {item.location}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: "rgba(109,120,225,0.12)", borderColor: COLORS.border },
          ]}
        >
          <Text style={[styles.badgeText, { color: COLORS.text }]}>{item.vocation}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Meta label={t("hunts.lvlMin")} value={String(item.levelMin)} />
        <Meta label={t("hunts.xpH")} value={formatBR(xp)} />
        <Meta label={t("hunts.profitH")} value={formatBR(prof)} />
        <Meta label="PT" value={showPt ? `x${pt}` : "off"} highlight />
        <Meta label="XP/h PT" value={formatBR(xpPT)} highlight />
        <Meta label="Profit PT" value={formatBR(profPT)} highlight />
      </View>

      <View style={styles.infoBlockRow}>
        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>{t("hunts.recDamage")}</Text>
          <Text style={styles.infoText}>{item.recommendedDamage}</Text>
        </View>

        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>{t("hunts.spawn")}</Text>

          <View style={styles.spawnWrap}>
            {(item.spawn || []).map((s) => {
              const charm = s.bestCharm || bestCharmFromWeakness(s.weaknesses);
              return (
                <View key={s.name} style={styles.spawnItem}>
                  <Image source={s.image} style={styles.spawnAvatar} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spawnName}>{s.name}</Text>
                    <Text style={styles.spawnCharm}>
                      {charm}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function Input({ value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(231,231,221,0.55)"
        keyboardType={keyboardType}
        style={styles.input}
      />
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
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
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

  headerWrap: { padding: 16, gap: 12 },
  listContent: { paddingBottom: 24, gap: 12 },

  header: {
    position: "relative",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 12, 35, 0.50)",
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

  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: COLORS.muted, marginTop: 6, lineHeight: 18 },

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
  searchIcon: { color: COLORS.muted, fontSize: 16 },
  searchInput: { flex: 1, color: COLORS.text, fontWeight: "700" },
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
  clearText: { color: COLORS.muted, fontWeight: "900" },

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

  huntCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(15, 12, 35, 0.68)",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(109,120,225,0.10)",
  },
  pillText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  filterLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 2 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  diffRow: { gap: 8, paddingRight: 6 },

  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  chipActive: { borderColor: "rgba(217,146,84,0.45)" },
  chipText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  pressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },

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

  creatureName: { color: COLORS.text, fontSize: 18, fontWeight: "900" },

  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontWeight: "900", fontSize: 12 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  metaLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  metaValue: { color: COLORS.text, fontWeight: "900" },

  infoBlock: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
    gap: 6,
  },
  infoBlockRow: { flexDirection: "row", gap: 10 },
  infoTitle: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  infoText: { color: COLORS.text, fontWeight: "700", lineHeight: 18 },

  inputsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  inputWrap: {
    flexGrow: 1,
    flexBasis: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(9, 7, 30, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { color: COLORS.text, fontWeight: "800" },

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

  huntHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  mainCreatureAvatar: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  huntNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  spawnWrap: {
    gap: 8,
    marginTop: 4,
  },
  spawnItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.18)",
    backgroundColor: "rgba(9, 7, 30, 0.20)",
  },
  spawnAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.18)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
  },
  spawnName: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },
  spawnCharm: {
    color: COLORS.gold,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 2,
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
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900", flex: 1 },
  modalCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  modalCloseText: { color: COLORS.text, fontWeight: "900" },
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
  youtubeBigText: { color: COLORS.text, fontWeight: "900" },
});