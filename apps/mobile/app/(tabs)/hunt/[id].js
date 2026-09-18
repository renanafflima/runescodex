import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { getHuntBySlug } from "@/src/api/hunts";
import {
  charmIcon,
  damageIcon,
  formatCharmLabel,
  formatCount,
  formatDifficultyLabel,
  formatElementLabel,
  formatLevelRange,
  formatRate,
  getHuntHero,
  hasNumericValue,
  huntsBackground,
  mapHuntDetail,
  resolveMapImage,
} from "@/src/data/hunts";

const youtubeIcon = require("@/assets/ui/youtube.png");

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

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 404) return t("hunts.empty");
  return t("auth.genericError");
}

function MetaRow({ icon, text, style }) {
  if (!text) return null;
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={14} color={COLORS.goldLight} />
      <Text style={[styles.blockText, style]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
}

export default function HuntDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const slug = Array.isArray(id) ? id[0] : id;
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);

  const loadHunt = useCallback(async () => {
    if (!slug) {
      setHunt(null);
      setError(t("hunts.empty"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getHuntBySlug(slug);
      setHunt(mapHuntDetail(data));
    } catch (err) {
      setHunt(null);
      setError(mapError(err, t));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useFocusEffect(
    useCallback(() => {
      loadHunt();
    }, [loadHunt]),
  );

  const elements = useMemo(() => {
    const seen = [];
    (hunt?.spawn || []).forEach((creature) => {
      (creature.elements || []).forEach((type) => {
        if (type && !seen.includes(type)) seen.push(type);
      });
    });
    return seen;
  }, [hunt]);
  const loot = hunt?.loot || [];
  const vocations = hunt?.vocations || [];
  const spawn = hunt?.spawn || [];
  const mapSource = hunt ? resolveMapImage(hunt.mapImage, hunt.creature) : null;

  return (
    <AppScreen>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(255,248,240,0.16)", "rgba(12,18,32,0.52)"]}
          style={StyleSheet.absoluteFill}
        />
        {loading ? (
          <View style={styles.missing}>
            <ActivityIndicator color={COLORS.goldLight} />
            <Text style={styles.missingText}>{t("common.loading")}</Text>
          </View>
        ) : !hunt ? (
          <View style={styles.missing}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backText}>{t("common.back")}</Text>
            </Pressable>
            <Text style={styles.missingText}>{error || t("hunts.empty")}</Text>
            <Pressable onPress={loadHunt} hitSlop={8}>
              <Text style={styles.backText}>{t("hunts.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View>
              <Image source={getHuntHero(hunt)} style={styles.hero} resizeMode="cover" />
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={2}>
                  {hunt.name}
                </Text>
                <View style={styles.nameActions}>
                  {mapSource ? (
                    <Pressable onPress={() => setMapOpen(true)} hitSlop={8} style={styles.iconBtn}>
                      <Ionicons name="map-outline" size={22} color={COLORS.goldLight} />
                    </Pressable>
                  ) : null}
                  {hunt.youtubeUrl ? (
                    <Pressable onPress={() => openUrl(hunt.youtubeUrl)} hitSlop={8} style={styles.iconBtn}>
                      <Image source={youtubeIcon} style={styles.ytIcon} resizeMode="contain" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <MetaRow icon="location-outline" text={hunt.location} style={styles.location} />
              <MetaRow icon="navigate-outline" text={hunt.subLocation} style={styles.subLocation} />
              <MetaRow
                icon="alert-circle-outline"
                text={hunt.difficulty ? `${t("hunts.difficulty")} ${formatDifficultyLabel(hunt.difficulty)}` : null}
                style={styles.stat}
              />

              {hunt.respawn ? (
                <Text style={styles.blockText}>
                  {t("hunts.respawn")}: {hunt.respawn}
                </Text>
              ) : null}

              {hunt.description ? <Text style={styles.blockText}>{hunt.description}</Text> : null}

              {vocations.length ? (
                <>
                  <Text style={styles.section}>{t("hunts.vocations")}</Text>
                  {vocations.map((entry, index) => {
                    const levelLabel = formatLevelRange(entry.levelMin, entry.levelMax);
                    const xpLabel = formatRate(entry.xpPerHour);
                    const profitLabel = formatRate(entry.profitPerHour);
                    return (
                      <View key={`${entry.vocation || "voc"}-${index}`} style={styles.vocationCard}>
                        {entry.vocation ? (
                          <MetaRow
                            icon="person-outline"
                            text={`${entry.vocation}${entry.isRecommended ? `  ·  ${t("hunts.recommended")}` : ""}`}
                            style={styles.vocationName}
                          />
                        ) : null}
                        {levelLabel ? (
                          <MetaRow icon="trending-up-outline" text={`${t("hunts.level")} ${levelLabel}`} />
                        ) : null}
                        {xpLabel ? (
                          <MetaRow icon="flash-outline" text={`${xpLabel} ${t("hunts.xpH")}`} />
                        ) : null}
                        {profitLabel ? (
                          <MetaRow icon="cash-outline" text={`${profitLabel} ${t("hunts.profitH")}`} />
                        ) : null}
                        {entry.notes ? <Text style={styles.blockText}>{entry.notes}</Text> : null}
                      </View>
                    );
                  })}
                </>
              ) : null}

              {spawn.length ? (
                <>
                  <Text style={styles.section}>{t("hunts.creatures")}</Text>
                  {spawn.map((creature) => {
                    const hpLabel = formatCount(creature.hp);
                    const xpLabel = formatCount(creature.xp);
                    const charm = creature.recommendedCharm;
                    const charmImage = charm ? charmIcon(charm) : null;
                    return (
                      <View key={creature.id || creature.name} style={styles.creatureCard}>
                        <View style={styles.creatureLine}>
                          {creature.image ? (
                            <Image source={creature.image} style={styles.creatureImg} resizeMode="contain" />
                          ) : null}
                          <View style={styles.creatureInfo}>
                            <Text style={styles.creatureName} numberOfLines={2}>
                              {creature.name}
                              {creature.isPrimary ? `  ·  ${t("hunts.primary")}` : ""}
                            </Text>
                            <View style={styles.creatureMeta}>
                              {hpLabel ? (
                                <Text style={styles.metaChip}>
                                  {t("hunts.hp")} {hpLabel}
                                </Text>
                              ) : null}
                              {xpLabel ? (
                                <Text style={styles.metaChip}>
                                  {t("hunts.xp")} {xpLabel}
                                </Text>
                              ) : null}
                              {creature.quantity != null ? (
                                <Text style={styles.metaChip}>
                                  {t("hunts.quantity")} {creature.quantity}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        {charm ? (
                          <View style={styles.iconLabelRow}>
                            {charmImage ? (
                              <Image source={charmImage} style={styles.dmgIcon} resizeMode="contain" />
                            ) : null}
                            <Text style={styles.blockText}>
                              {t("hunts.charm")}: {formatCharmLabel(charm)}
                            </Text>
                          </View>
                        ) : null}
                        {creature.damageType ? (
                          <Text style={styles.blockText}>
                            {t("hunts.recDamage")}: {formatCharmLabel(creature.damageType)}
                          </Text>
                        ) : null}
                        {creature.notes ? <Text style={styles.blockText}>{creature.notes}</Text> : null}
                        {(creature.elements || []).length ? (
                          <View style={styles.dmgRow}>
                            {(creature.elements || []).map((type) => {
                              const icon = damageIcon(type);
                              const label = formatElementLabel(type);
                              if (!icon && !label) return null;
                              return (
                                <View key={`${creature.name}-${type}`} style={styles.iconLabelRow}>
                                  {icon ? (
                                    <Image source={icon} style={styles.dmgIcon} resizeMode="contain" />
                                  ) : null}
                                  {label ? <Text style={styles.metaChip}>{label}</Text> : null}
                                </View>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              ) : null}

              {elements.length ? (
                <>
                  <Text style={styles.section}>{t("hunts.elements")}</Text>
                  <View style={styles.dmgRow}>
                    {elements.map((type) => {
                      const icon = damageIcon(type);
                      const label = formatElementLabel(type);
                      if (!icon && !label) return null;
                      return (
                        <View key={type} style={styles.iconLabelRow}>
                          {icon ? (
                            <Image source={icon} style={styles.elementIcon} resizeMode="contain" />
                          ) : null}
                          {label ? <Text style={styles.metaChip}>{label}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {loot.length ? (
                <>
                  <Text style={styles.section}>{t("hunts.mainLoot")}</Text>
                  {loot.map((item) => {
                    const valueLabel = hasNumericValue(item.estimatedValue)
                      ? formatRate(item.estimatedValue)
                      : null;
                    return (
                      <View key={item.id || item.itemName} style={styles.lootRow}>
                        {item.image ? (
                          <Image source={item.image} style={styles.lootImg} resizeMode="contain" />
                        ) : null}
                        <View style={styles.lootInfo}>
                          <Text style={styles.blockText} numberOfLines={2}>
                            {item.itemName}
                          </Text>
                          {valueLabel ? <Text style={styles.metaChip}>{valueLabel}</Text> : null}
                          {item.importance ? (
                            <Text style={styles.metaChip}>{item.importance}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}
            </View>
          </ScrollView>
        )}

        {hunt ? (
          <Modal visible={mapOpen} transparent animationType="fade" onRequestClose={() => setMapOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>
                    {t("hunts.mapTitle", { name: hunt.creature || hunt.name })}
                  </Text>
                  <Pressable onPress={() => setMapOpen(false)}>
                    <Text style={styles.link}>{t("common.close")}</Text>
                  </Pressable>
                </View>
                {mapSource ? (
                  <Image source={mapSource} style={styles.mapImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.blockText}>{t("hunts.mapMissing")}</Text>
                )}
              </View>
            </View>
          </Modal>
        ) : null}
      </ImageBackground>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { paddingBottom: 120 },
  hero: { width: "100%", height: 220 },
  backBtn: {
    position: "absolute",
    top: 14,
    left: 10,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 18, paddingTop: 16, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  nameActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: COLORS.text, fontSize: 26, fontWeight: "800", flex: 1, minWidth: 0 },
  location: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "600" },
  subLocation: { color: COLORS.textMuted, fontSize: 13 },
  stat: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  section: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 14,
  },
  blockText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  vocationCard: { gap: 4, paddingTop: 4 },
  vocationName: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  creatureCard: { gap: 6, paddingTop: 8 },
  creatureLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatureImg: { width: 42, height: 42 },
  creatureInfo: { flex: 1, minWidth: 0, gap: 4 },
  creatureName: { color: COLORS.text, fontWeight: "700" },
  creatureMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  iconLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dmgRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  dmgIcon: { width: 18, height: 18 },
  elementIcon: { width: 22, height: 22 },
  lootRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 },
  lootImg: { width: 28, height: 28 },
  lootInfo: { flex: 1, minWidth: 0, gap: 2 },
  link: { color: COLORS.goldLight, fontWeight: "800" },
  ytIcon: { width: 22, height: 22 },
  missing: { flex: 1, padding: 18, gap: 12, justifyContent: "center" },
  missingText: { color: COLORS.text },
  backText: { color: COLORS.goldLight, fontWeight: "800" },
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
