import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Linking,
  Modal,
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
import { Colors as COLORS, Radius } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { listHunts } from "@/src/api/hunts";
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
  mapHuntListItem,
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
  if (!url) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(url);
  } catch {
    // ignore
  }
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState("");
  const [vocation, setVocation] = useState("Any");
  const [difficulty, setDifficulty] = useState("Any");
  const [minXpH, setMinXpH] = useState("");
  const [minProfitH, setMinProfitH] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [sortBy, setSortBy] = useState("Best XP");
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapHunt, setMapHunt] = useState(null);

  const loadHunts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const level = toNumberOrNull(minLevel);
      const data = await listHunts({
        vocation: vocation === "Any" ? undefined : vocation,
        difficulty: difficulty === "Any" ? undefined : difficulty,
        level: level || undefined,
      });
      const mapped = (Array.isArray(data) ? data : []).map((hunt) =>
        mapHuntListItem(hunt, vocation),
      );
      setHunts(mapped);
    } catch (err) {
      setHunts([]);
      setError(mapError(err, t));
    } finally {
      setLoading(false);
    }
  }, [difficulty, minLevel, t, vocation]);

  useFocusEffect(
    useCallback(() => {
      loadHunts();
    }, [loadHunts]),
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLocaleLowerCase();
    const xpN = toNumberOrNull(minXpH);
    const profN = toNumberOrNull(minProfitH);
    const locN = toNumberOrNull(minLevel);

    let arr = hunts.filter((h) => {
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
      return matchQ && matchXp && matchProfit && matchLevel;
    });

    arr = [...arr].sort((a, b) => {
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
  }, [hunts, minLevel, minProfitH, minXpH, q, sortBy]);

  const mapSource = mapHunt ? resolveMapImage(mapHunt.mapImage, mapHunt.creature) : null;

  return (
    <AppScreen>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(255,248,240,0.18)", "rgba(12,18,32,0.48)"]}
          style={StyleSheet.absoluteFill}
        />
        <FlatList
          data={error ? [] : filtered}
          keyExtractor={(item) => item.slug || item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Image source={huntsHero} style={styles.hero} resizeMode="cover" />
              <View style={styles.headerWrap}>
                <Text style={styles.title}>{t("hunts.title")}</Text>
                <View style={styles.searchRow}>
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
                <Pressable onPress={() => setFiltersOpen((open) => !open)} hitSlop={8}>
                  <Text style={styles.filtersToggle}>
                    {t("common.filters")} {filtersOpen ? "−" : "+"}
                  </Text>
                </Pressable>
                {filtersOpen ? (
                  <View style={styles.filters}>
                    <Text style={styles.filterLabel}>{t("hunts.vocation")}</Text>
                    <View style={styles.chipsRow}>
                      {VOCS.map((v) => (
                        <Pressable key={v} onPress={() => setVocation(v)}>
                          <Text style={[styles.chip, vocation === v && styles.chipActive]}>{v}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>{t("hunts.difficulty")}</Text>
                    <View style={styles.chipsRow}>
                      {DIFFICULTIES.map((value) => (
                        <Pressable key={value} onPress={() => setDifficulty(value)}>
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
                        <Pressable key={s} onPress={() => setSortBy(s)}>
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
              onPress={() => router.push(`/(tabs)/hunt/${item.slug}`)}
              onOpenMap={() => setMapHunt(item)}
            />
          )}
        />

        <Modal visible={Boolean(mapHunt)} transparent animationType="fade" onRequestClose={() => setMapHunt(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>
                  {t("hunts.mapTitle", { name: mapHunt?.creature || mapHunt?.name || "" })}
                </Text>
                <Pressable onPress={() => setMapHunt(null)}>
                  <Text style={styles.link}>{t("common.close")}</Text>
                </Pressable>
              </View>
              {mapSource ? (
                <Image source={mapSource} style={styles.mapImage} resizeMode="contain" />
              ) : (
                <Text style={styles.empty}>{t("hunts.mapMissing")}</Text>
              )}
            </View>
          </View>
        </Modal>
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

function HuntRow({ item, onPress, onOpenMap }) {
  const { t } = useI18n();
  const levelLabel = formatLevelRange(item.levelMin, item.levelMax);
  const vocationLabels = (item.vocations || [])
    .map((entry) => entry.vocation)
    .filter(Boolean);
  const uniqueVocations = [...new Set(vocationLabels)];
  const xpLabel = formatRate(item.xpH);
  const profitLabel = formatRate(item.profitH);
  const mapSource = resolveMapImage(item.mapImage, item.creature);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable onPress={onPress} style={styles.cardTitleHit} hitSlop={4}>
          <Text style={styles.rowName} numberOfLines={2}>
            {item.name}
          </Text>
        </Pressable>
        <View style={styles.cardActions}>
          {mapSource ? (
            <Pressable onPress={onOpenMap} hitSlop={8} style={styles.iconBtn}>
              <Ionicons name="map-outline" size={20} color={COLORS.goldLight} />
            </Pressable>
          ) : null}
          {item.youtubeUrl ? (
            <Pressable onPress={() => openUrl(item.youtubeUrl)} hitSlop={8} style={styles.iconBtn}>
              <Image source={youtubeIcon} style={styles.ytIcon} resizeMode="contain" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable onPress={onPress} style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}>
        <MetaRow icon="location-outline" text={item.displayLocation} style={styles.rowLoc} />
        <MetaRow icon="trending-up-outline" text={levelLabel ? `${t("hunts.level")} ${levelLabel}` : null} />
        <MetaRow icon="person-outline" text={uniqueVocations.length ? uniqueVocations.join(" · ") : null} />
        <MetaRow
          icon="alert-circle-outline"
          text={item.difficulty ? formatDifficultyLabel(item.difficulty) : null}
        />
        <MetaRow icon="flash-outline" text={xpLabel ? `${xpLabel} ${t("hunts.xpH")}` : null} />
        <MetaRow icon="cash-outline" text={profitLabel ? `${profitLabel} ${t("hunts.profitH")}` : null} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  listContent: { paddingBottom: 120, flexGrow: 1 },
  hero: { width: "100%", height: 168 },
  headerWrap: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, gap: 10 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  filtersToggle: { color: COLORS.goldLight, fontWeight: "800", fontSize: 14, letterSpacing: 0.4 },
  filters: { gap: 8, paddingTop: 4 },
  searchRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(212,167,44,0.28)" },
  searchInput: { color: COLORS.text, fontWeight: "700", paddingVertical: 8 },
  filterLabel: { color: COLORS.textSecondary, fontWeight: "700", fontSize: 12, marginTop: 4 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingRight: 8 },
  chip: { color: COLORS.textMuted, fontWeight: "700", fontSize: 13 },
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
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(17,24,39,0.72)",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitleHit: { flex: 1, minWidth: 0 },
  cardBody: { gap: 6 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ytIcon: { width: 20, height: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  rowName: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  rowLoc: { color: COLORS.textSecondary, fontWeight: "600" },
  rowStat: { color: COLORS.text, fontWeight: "700", fontSize: 14, flex: 1, minWidth: 0 },
  pressed: { opacity: 0.88 },
  link: { color: COLORS.goldLight, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: { gap: 12 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: COLORS.text, fontWeight: "800", flex: 1, paddingRight: 12 },
  mapImage: { width: "100%", height: 280 },
});
