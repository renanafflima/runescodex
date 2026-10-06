import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth/AuthContext";
import { Colors as COLORS, Radius } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import HuntMapScreen from "@/components/hunts/HuntMapScreen";
import { listAllHunts } from "@/src/api/hunts";
import { openHttpsUrl } from "@/src/security/https-url";
import { createLatestRequest } from "@/src/runtime/focusWork";
import {
  DIFFICULTIES,
  SORTS,
  VOCS,
  formatDifficultyLabel,
  formatLevelRange,
  formatRate,
  hasNumericValue,
  huntsBackground,
  huntsHero,
  huntCompatibility,
  mapHuntListItem,
  normalizeVocation,
  resolveMapImage,
  toNumberOrNull,
} from "@/src/data/hunts";

const youtubeIcon = require("@/assets/ui/youtube.png");

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  return t("auth.genericError");
}

function includesQuery(value, query) {
  return String(value || "").toLocaleLowerCase().includes(query);
}

async function openUrl(url) {
  await openHttpsUrl(Linking, url);
}

function MetaRow({ icon, text, style }) {
  if (!text) return null;
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={14} color={COLORS.goldLight} />
      <Text style={[styles.rowStat, style]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

export default function HuntsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { activeCharacter } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState("");
  const [vocation, setVocation] = useState("Any");
  const preferredVocation =
    vocation !== "Any" ? vocation : normalizeVocation(activeCharacter?.vocation);
  const [difficulty, setDifficulty] = useState("Any");
  const [minXpH, setMinXpH] = useState("");
  const [minProfitH, setMinProfitH] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [sortBy, setSortBy] = useState("Best XP");
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapHunt, setMapHunt] = useState(null);
  const huntRequests = useRef(createLatestRequest()).current;

  const loadHunts = useCallback(async () => {
    const current = huntRequests.start();
    setLoading(true);
    setError("");
    try {
      const items = await listAllHunts();
      if (!current()) return;
      setHunts(items);
    } catch (err) {
      if (!current()) return;
      setHunts([]);
      setError(mapError(err, t));
    } finally {
      if (current()) setLoading(false);
    }
  }, [huntRequests, t]);

  useFocusEffect(
    useCallback(() => {
      loadHunts();
      return () => {
        huntRequests.cancel();
      };
    }, [huntRequests, loadHunts]),
  );

  const catalog = useMemo(
    () => hunts.map((hunt) => mapHuntListItem(hunt, preferredVocation)),
    [hunts, preferredVocation],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLocaleLowerCase();
    const xpN = toNumberOrNull(minXpH);
    const profN = toNumberOrNull(minProfitH);
    const locN = toNumberOrNull(minLevel);

    let arr = catalog.filter((h) => {
      const matchVocation =
        vocation === "Any" || (h.vocations || []).some((entry) => entry.vocation === vocation);
      const matchDifficulty = difficulty === "Any" || h.difficulty === difficulty;
      const matchQ =
        !query ||
        includesQuery(h.name, query) ||
        includesQuery(h.location, query) ||
        includesQuery(h.subLocation, query) ||
        includesQuery(h.displayLocation, query) ||
        includesQuery(h.creature, query) ||
        (h.spawn || []).some((s) => includesQuery(s.name, query));
      const matchXp = xpN ? hasNumericValue(h.xpH) && Number(h.xpH) >= xpN : true;
      const matchProfit = profN ? hasNumericValue(h.profitH) && Number(h.profitH) >= profN : true;
      const matchLevel = locN
        ? (h.vocations || []).some((item) => {
            const min = item.levelMin;
            const max = item.levelMax;
            if (min == null && max == null) return false;
            if (min != null && locN < Number(min)) return false;
            if (max != null && locN > Number(max)) return false;
            return true;
          })
        : true;
      return matchVocation && matchDifficulty && matchQ && matchXp && matchProfit && matchLevel;
    });

    arr = [...arr].sort((a, b) => {
      const compatibilityDiff =
        huntCompatibility(b, activeCharacter) - huntCompatibility(a, activeCharacter);
      if (compatibilityDiff) return compatibilityDiff;
      if (sortBy === "Best XP") {
        const aXp = hasNumericValue(a.xpH) ? Number(a.xpH) : -1;
        const bXp = hasNumericValue(b.xpH) ? Number(b.xpH) : -1;
        return bXp - aXp;
      }
      if (sortBy === "Best Profit") {
        const aProfit = hasNumericValue(a.profitH) ? Number(a.profitH) : -1;
        const bProfit = hasNumericValue(b.profitH) ? Number(b.profitH) : -1;
        return bProfit - aProfit;
      }
      if (sortBy === "Level") {
        const aLevel = hasNumericValue(a.levelMin) ? Number(a.levelMin) : Number.POSITIVE_INFINITY;
        const bLevel = hasNumericValue(b.levelMin) ? Number(b.levelMin) : Number.POSITIVE_INFINITY;
        return aLevel - bLevel;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return arr;
  }, [activeCharacter, catalog, difficulty, minLevel, minProfitH, minXpH, q, sortBy, vocation]);

  const mapSource = mapHunt ? resolveMapImage(mapHunt.mapImage, mapHunt.creature) : null;

  return (
    <AppScreen>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.bg}>
        <View style={styles.dim} />
        <FlatList
          data={error ? [] : filtered}
          keyExtractor={(item) => item.slug || item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <Image source={huntsHero} style={styles.heroArt} resizeMode="cover" />
                <LinearGradient
                  colors={["rgba(5,8,14,0.05)", "rgba(5,8,14,0.25)", "rgba(5,8,14,0.88)"]}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>{t("hunts.heroKicker")}</Text>
                  <Text style={styles.title}>{t("hunts.title")}</Text>
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {t("hunts.subtitle")}
                  </Text>
                </View>
              </View>
              <View style={styles.headerWrap}>
                <View style={styles.searchRow}>
                  <Ionicons name="search" size={18} color={COLORS.goldLight} />
                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder={t("hunts.search")}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.contextRow}>
                  <View style={styles.contextCopy}>
                    <Text style={styles.sectionKicker}>{t("hunts.recommendedHunts")}</Text>
                    {activeCharacter ? (
                      <Text style={styles.contextText} numberOfLines={1}>
                        {t("hunts.forCharacter", { name: activeCharacter.name })}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setFiltersOpen((open) => !open)} style={styles.filtersBtn}>
                    <Ionicons
                      name={filtersOpen ? "options" : "options-outline"}
                      size={15}
                      color={COLORS.goldLight}
                    />
                    <Text style={styles.filtersToggle}>{t("common.filters")}</Text>
                  </Pressable>
                </View>
                {filtersOpen ? (
                  <View style={styles.filters}>
                    <Text style={styles.filterLabel}>{t("hunts.vocation")}</Text>
                    <View style={styles.chipsRow}>
                      {VOCS.map((v) => (
                        <Pressable key={v} onPress={() => setVocation(v)} style={styles.chipBtn}>
                          <Text style={[styles.chip, vocation === v && styles.chipActive]}>{v}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>{t("hunts.difficulty")}</Text>
                    <View style={styles.chipsRow}>
                      {DIFFICULTIES.map((value) => (
                        <Pressable key={value} onPress={() => setDifficulty(value)} style={styles.chipBtn}>
                          <Text style={[styles.chip, difficulty === value && styles.chipActive]}>
                            {value === "Any" ? value : formatDifficultyLabel(value)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>{t("hunts.mins")}</Text>
                    <View style={styles.inputsRow}>
                      <TextInput
                        value={minLevel}
                        onChangeText={setMinLevel}
                        placeholder={t("hunts.minLevel")}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        style={styles.miniInput}
                      />
                      <TextInput
                        value={minXpH}
                        onChangeText={setMinXpH}
                        placeholder={t("hunts.minXp")}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        style={styles.miniInput}
                      />
                      <TextInput
                        value={minProfitH}
                        onChangeText={setMinProfitH}
                        placeholder={t("hunts.minProfit")}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        style={styles.miniInput}
                      />
                    </View>
                    <Text style={styles.filterLabel}>{t("hunts.sort")}</Text>
                    <View style={styles.chipsRow}>
                      {SORTS.map((s) => (
                        <Pressable key={s} onPress={() => setSortBy(s)} style={styles.chipBtn}>
                          <Text style={[styles.chip, sortBy === s && styles.chipActive]}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                {loading && hunts.length ? (
                  <ActivityIndicator color={COLORS.goldLight} style={styles.refreshIndicator} />
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            <ListState
              loading={loading}
              error={error}
              huntsCount={hunts.length}
              onRetry={loadHunts}
            />
          }
          renderItem={({ item }) => (
            <HuntRow
              item={item}
              recommended={huntCompatibility(item, activeCharacter) === 4}
              onPress={() => router.push(`/(tabs)/hunt/${item.slug}`)}
              onOpenMap={() => setMapHunt(item)}
            />
          )}
        />

        <HuntMapScreen
          visible={Boolean(mapHunt)}
          title={mapHunt ? t("hunts.mapTitle", { name: mapHunt.name }) : ""}
          source={mapSource}
          onClose={() => setMapHunt(null)}
        />
      </ImageBackground>
    </AppScreen>
  );
}

function ListState({ loading, error, huntsCount, onRetry }) {
  const { t } = useI18n();

  if (loading && huntsCount === 0) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator color={COLORS.goldLight} />
        <Text style={styles.empty}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.empty}>{error}</Text>
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>{t("hunts.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stateWrap}>
      <Text style={styles.empty}>{huntsCount === 0 ? t("hunts.emptyCatalog") : t("hunts.empty")}</Text>
    </View>
  );
}

function HuntRow({ item, recommended, onPress, onOpenMap }) {
  const { t } = useI18n();
  const levelLabel = formatLevelRange(item.levelMin, item.levelMax);
  const vocationLabels = (item.vocations || [])
    .map((entry) => entry.vocation)
    .filter(Boolean);
  const uniqueVocations = [...new Set(vocationLabels)];
  const xpLabel = formatRate(item.xpH);
  const profitLabel = formatRate(item.profitH);
  const mapSource = resolveMapImage(item.mapImage, item.creature);

  const art = item.creatureImage || huntsHero;

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        <View style={styles.cardArt}>
          <Image
            source={art}
            style={styles.cardImage}
            resizeMode={item.creatureImage ? "contain" : "cover"}
          />
          <LinearGradient
            colors={["rgba(5,8,14,0.05)", "rgba(5,8,14,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardTitleRow} pointerEvents="box-none">
            <View style={styles.cardTitleCopy}>
              {recommended ? <Text style={styles.matchLabel}>{t("hunts.goodMatch")}</Text> : null}
              <Text style={styles.rowName} numberOfLines={2}>
                {item.name}
              </Text>
              <MetaRow icon="location-outline" text={item.displayLocation} style={styles.rowLoc} />
            </View>
          </View>
        </View>
      </Pressable>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}>
        <View style={styles.factsRow}>
          <HuntFact icon="trending-up-outline" value={levelLabel ? `${t("hunts.level")} ${levelLabel}` : null} />
          <HuntFact icon="flash-outline" value={xpLabel ? `${xpLabel} ${t("hunts.xpH")}` : null} />
          <HuntFact icon="cash-outline" value={profitLabel ? `${profitLabel} ${t("hunts.profitH")}` : null} accent />
        </View>
        <View style={styles.secondaryFacts}>
          <Text style={styles.secondaryText} numberOfLines={1}>
            {uniqueVocations.join(" · ")}
          </Text>
          {item.difficulty ? <Text style={styles.dot}>·</Text> : null}
          <Text style={styles.secondaryText}>{formatDifficultyLabel(item.difficulty)}</Text>
        </View>
      </Pressable>
      <View style={styles.actionRow}>
        {item.youtubeUrl ? (
          <Pressable onPress={() => openUrl(item.youtubeUrl)} style={styles.actionButton}>
            <Image source={youtubeIcon} style={styles.ytIcon} resizeMode="contain" />
            <Text style={styles.actionText}>{t("hunts.watchYoutube")}</Text>
          </Pressable>
        ) : null}
        {mapSource ? (
          <Pressable onPress={onOpenMap} style={styles.actionButton}>
            <Ionicons name="map-outline" size={17} color={COLORS.textSecondary} />
            <Text style={styles.actionText}>{t("hunts.seeMap")}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onPress} style={styles.detailButton}>
          <Text style={styles.detailText}>{t("hunts.seeDetails")}</Text>
          <Ionicons name="chevron-forward" size={15} color={COLORS.goldLight} />
        </Pressable>
      </View>
    </View>
  );
}

function HuntFact({ icon, value, accent }) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={accent ? COLORS.success : COLORS.goldLight} />
      <Text style={[styles.factText, accent && styles.profitText]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,8,14,0.82)" },
  listContent: { paddingBottom: 36, flexGrow: 1 },
  hero: {
    width: "100%",
    aspectRatio: 1.5,
    overflow: "hidden",
    backgroundColor: "#070b12",
    justifyContent: "flex-end",
  },
  heroArt: { ...StyleSheet.absoluteFillObject },
  heroCopy: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 28 },
  headerWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 10 },
  eyebrow: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#d6deea", fontSize: 13, lineHeight: 18, marginTop: 4 },
  searchRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.32)",
    backgroundColor: "rgba(8,14,24,0.92)",
    paddingHorizontal: 12,
  },
  contextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  contextCopy: { flex: 1, minWidth: 0 },
  sectionKicker: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  contextText: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  filtersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.45)",
    backgroundColor: "rgba(212,167,44,0.12)",
  },
  filtersToggle: { color: COLORS.goldLight, fontWeight: "800", fontSize: 12 },
  filters: { gap: 8, paddingTop: 4 },
  searchInput: { flex: 1, minWidth: 0, color: COLORS.text, fontWeight: "700", paddingVertical: 4 },
  filterLabel: { color: COLORS.textSecondary, fontWeight: "700", fontSize: 12, marginTop: 4 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.28)",
    backgroundColor: "rgba(8,14,24,0.72)",
  },
  chip: { color: COLORS.textMuted, fontWeight: "700", fontSize: 12 },
  chipActive: { color: COLORS.goldLight },
  inputsRow: { flexDirection: "row", gap: 10 },
  miniInput: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(248,250,252,0.16)",
  },
  refreshIndicator: { marginTop: 4 },
  stateWrap: { paddingHorizontal: 18, marginTop: 16, gap: 12 },
  empty: { color: COLORS.textSecondary },
  retry: { color: COLORS.goldLight, fontWeight: "800", fontSize: 14 },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: "rgba(10,16,28,0.94)",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.22)",
  },
  cardArt: {
    width: "100%",
    aspectRatio: 1.85,
    backgroundColor: "#070b12",
    justifyContent: "flex-end",
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardTitleRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cardTitleCopy: { flex: 1, minWidth: 0, gap: 4 },
  matchLabel: {
    color: COLORS.goldLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  cardBody: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.16)",
  },
  factsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fact: { flexDirection: "row", alignItems: "center", gap: 5 },
  factText: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  profitText: { color: "#8bddaa" },
  secondaryFacts: { flexDirection: "row", alignItems: "center", minWidth: 0 },
  secondaryText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  dot: { color: COLORS.textMuted, marginHorizontal: 7 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 10,
    gap: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 7,
  },
  actionText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700" },
  detailButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 40,
    paddingLeft: 8,
  },
  detailText: { color: COLORS.goldLight, fontSize: 12, fontWeight: "800" },
  ytIcon: { width: 18, height: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  rowName: { color: COLORS.text, fontSize: 16, fontWeight: "800", flex: 1, minWidth: 0 },
  rowLoc: { color: COLORS.textSecondary, fontWeight: "600" },
  rowStat: { color: COLORS.text, fontWeight: "700", fontSize: 14, flex: 1, minWidth: 0 },
  pressed: { opacity: 0.88 },
});
