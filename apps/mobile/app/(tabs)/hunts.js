import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { listHunts } from "@/src/api/hunts";
import {
  PTS,
  SORTS,
  VOCS,
  clampPT,
  damageIcon,
  formatRate,
  huntsBackground,
  huntsHero,
  mapHuntListItem,
  toNumberOrNull,
} from "@/src/data/hunts";

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  return t("auth.genericError");
}

export default function HuntsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState("");
  const [vocation, setVocation] = useState("Any");
  const [minXpH, setMinXpH] = useState("");
  const [minProfitH, setMinProfitH] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [pt, setPt] = useState(1);
  const [applyPt, setApplyPt] = useState(true);
  const [sortBy, setSortBy] = useState("Best XP");
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHunts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const level = toNumberOrNull(minLevel);
      const data = await listHunts({
        vocation: vocation === "Any" ? undefined : vocation,
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
  }, [minLevel, t, vocation]);

  useFocusEffect(
    useCallback(() => {
      loadHunts();
    }, [loadHunts]),
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const xpN = toNumberOrNull(minXpH);
    const profN = toNumberOrNull(minProfitH);
    const mult = applyPt ? pt : 1;

    let arr = hunts.filter((h) => {
      const matchQ =
        !query ||
        h.name.toLowerCase().includes(query) ||
        String(h.creature || "").toLowerCase().includes(query) ||
        String(h.location || "").toLowerCase().includes(query) ||
        (h.spawn || []).some((s) => String(s.name).toLowerCase().includes(query));
      const matchXp = xpN ? Number(h.xpH) * mult >= xpN : true;
      const matchProfit = profN ? Number(h.profitH) * mult >= profN : true;
      return matchQ && matchXp && matchProfit;
    });

    arr = [...arr].sort((a, b) => {
      if (sortBy === "Best XP") return Number(b.xpH) * mult - Number(a.xpH) * mult;
      if (sortBy === "Best Profit") return Number(b.profitH) * mult - Number(a.profitH) * mult;
      if (sortBy === "Level") return Number(a.levelMin) - Number(b.levelMin);
      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [applyPt, hunts, minProfitH, minXpH, pt, q, sortBy]);

  return (
    <AppScreen>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(7,11,20,0.35)", "rgba(7,11,20,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.slug || item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <Image source={huntsHero} style={styles.hero} resizeMode="cover" />
              <View style={styles.headerWrap}>
                <Text style={styles.title}>{t("hunts.title")}</Text>
                <Pressable onPress={() => setFiltersOpen((open) => !open)} hitSlop={8}>
                  <Text style={styles.filtersToggle}>
                    {t("common.filters")} {filtersOpen ? "−" : "+"}
                  </Text>
                </Pressable>
                {filtersOpen ? (
                  <View style={styles.filters}>
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
                    <Text style={styles.filterLabel}>{t("hunts.vocation")}</Text>
                    <View style={styles.chipsRow}>
                      {VOCS.map((v) => (
                        <Pressable key={v} onPress={() => setVocation(v)}>
                          <Text style={[styles.chip, vocation === v && styles.chipActive]}>{v}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => setApplyPt((s) => !s)}>
                      <Text style={styles.filterLabel}>
                        {t("hunts.applyPt")}: {applyPt ? "on" : "off"}
                      </Text>
                    </Pressable>
                    <Text style={styles.filterLabel}>{t("hunts.ptLabel")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipsRow}>
                        {PTS.map((m) => (
                          <Pressable key={m} onPress={() => setPt(clampPT(m))}>
                            <Text style={[styles.chip, pt === m && styles.chipActive]}>{`x${m}`}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
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
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={COLORS.goldLight} style={{ marginTop: 16 }} />
            ) : (
              <Text style={styles.empty}>{error || t("hunts.empty")}</Text>
            )
          }
          renderItem={({ item }) => (
            <HuntRow item={item} onPress={() => router.push(`/(tabs)/hunt/${item.slug}`)} />
          )}
        />
      </ImageBackground>
    </AppScreen>
  );
}

function HuntRow({ item, onPress }) {
  const { t } = useI18n();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowHead}>
        {item.creatureImage ? (
          <Image source={item.creatureImage} style={styles.rowCreature} resizeMode="contain" />
        ) : (
          <View style={styles.rowCreature} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowLoc}>{item.location}</Text>
        </View>
      </View>
      <Text style={styles.rowStat}>
        {t("hunts.level")} {item.levelMin != null ? `${item.levelMin}+` : "—"}
      </Text>
      <Text style={styles.rowStat}>
        {formatRate(item.xpH)} {t("hunts.xpH")}
      </Text>
      <Text style={styles.rowStat}>
        {formatRate(item.profitH)} {t("hunts.profitH")}
      </Text>
      <Text style={styles.rowPt}>
        {PTS.map((mult) => `PT x${mult} ${formatRate(Number(item.xpH) * mult)}/${formatRate(Number(item.profitH) * mult)}`).join("   ")}
      </Text>
      {item.respawn ? (
        <Text style={styles.rowMeta}>
          {t("hunts.respawn")}: {item.respawn}
        </Text>
      ) : null}
      <View style={styles.spawnList}>
        {(item.spawn || []).map((creature) => (
          <View key={creature.name} style={styles.spawnLine}>
            {creature.image ? (
              <Image source={creature.image} style={styles.spawnImg} resizeMode="contain" />
            ) : (
              <View style={styles.spawnImg} />
            )}
            <Text style={styles.spawnName}>{creature.name}</Text>
            <View style={styles.dmgRow}>
              {(creature.weaknesses || []).map((type) => {
                const icon = damageIcon(type);
                if (!icon) return null;
                return <Image key={`${creature.name}-${type}`} source={icon} style={styles.dmgIcon} resizeMode="contain" />;
              })}
            </View>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  listContent: { paddingBottom: 120 },
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
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(248,250,252,0.16)",
  },
  empty: { color: COLORS.textSecondary, paddingHorizontal: 18, marginTop: 16 },
  row: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,167,44,0.16)",
    gap: 6,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCreature: { width: 54, height: 54 },
  rowName: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  rowLoc: { color: COLORS.textSecondary, marginTop: 2, fontSize: 13 },
  rowStat: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  rowPt: { color: COLORS.goldLight, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  rowMeta: { color: COLORS.textSecondary, fontSize: 12 },
  spawnList: { gap: 6, marginTop: 4 },
  spawnLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  spawnImg: { width: 28, height: 28 },
  spawnName: { color: COLORS.text, flex: 1, fontSize: 13, fontWeight: "600" },
  dmgRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  dmgIcon: { width: 16, height: 16 },
  pressed: { opacity: 0.88 },
});
