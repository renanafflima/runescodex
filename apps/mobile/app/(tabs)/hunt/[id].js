import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/src/i18n";
import { useAuth } from "@/src/auth/AuthContext";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import HuntMapScreen from "@/components/hunts/HuntMapScreen";
import { getHuntBySlug } from "@/src/api/hunts";
import { createLatestRequest } from "@/src/runtime/focusWork";
import { openHttpsUrl } from "@/src/security/https-url";
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
  normalizeVocation,
  resolveMapImage,
} from "@/src/data/hunts";

const youtubeIcon = require("@/assets/ui/youtube.png");

async function openUrl(url) {
  await openHttpsUrl(Linking, url);
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
  const { activeCharacter } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const slug = Array.isArray(id) ? id[0] : id;
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const huntRequests = useRef(createLatestRequest()).current;

  const loadHunt = useCallback(async () => {
    const current = huntRequests.start();
    if (!slug) {
      if (!current()) return;
      setHunt(null);
      setError(t("hunts.empty"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getHuntBySlug(slug);
      if (!current()) return;
      setHunt(mapHuntDetail(data, normalizeVocation(activeCharacter?.vocation)));
    } catch (err) {
      if (!current()) return;
      setHunt(null);
      setError(mapError(err, t));
    } finally {
      if (current()) setLoading(false);
    }
  }, [activeCharacter, huntRequests, slug, t]);

  useFocusEffect(
    useCallback(() => {
      loadHunt();
      return () => {
        huntRequests.cancel();
      };
    }, [huntRequests, loadHunt]),
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
  const heroLevel = hunt ? formatLevelRange(hunt.levelMin, hunt.levelMax) : null;
  const heroXp = hunt ? formatRate(hunt.xpH) : null;
  const heroProfit = hunt ? formatRate(hunt.profitH) : null;

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
            <View style={styles.hero}>
              <Image source={getHuntHero(hunt)} style={styles.heroArt} resizeMode="cover" />
              <LinearGradient
                colors={["rgba(5,8,14,0.08)", "rgba(5,8,14,0.48)", "rgba(5,8,14,0.98)"]}
                locations={[0, 0.42, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={COLORS.text} />
              </Pressable>
              <View style={styles.heroContent}>
                <Text style={styles.eyebrow}>{t("hunts.detailKicker")}</Text>
                <Text style={styles.name} numberOfLines={3}>{hunt.name}</Text>
                <MetaRow icon="location-outline" text={hunt.displayLocation} style={styles.location} />
                <View style={styles.badges}>
                  {hunt.difficulty ? <Text style={styles.badge}>{formatDifficultyLabel(hunt.difficulty)}</Text> : null}
                  {heroLevel ? <Text style={styles.badge}>{t("hunts.level")} {heroLevel}</Text> : null}
                  {hunt.vocation ? <Text style={styles.badge}>{hunt.vocation}</Text> : null}
                </View>
                <View style={styles.heroStats}>
                  <HeroStat label={t("hunts.xpH")} value={heroXp} />
                  <HeroStat label={t("hunts.profitH")} value={heroProfit} accent />
                  <HeroStat label={t("hunts.creatures")} value={spawn.length ? String(spawn.length) : null} />
                </View>
                <View style={styles.heroActions}>
                  {hunt.youtubeUrl ? (
                    <Pressable onPress={() => openUrl(hunt.youtubeUrl)} style={styles.primaryAction}>
                      <Image source={youtubeIcon} style={styles.ytIcon} resizeMode="contain" />
                      <Text style={styles.primaryActionText}>{t("hunts.watchYoutube")}</Text>
                    </Pressable>
                  ) : null}
                  {mapSource ? (
                    <Pressable onPress={() => setMapOpen(true)} style={styles.secondaryAction}>
                      <Ionicons name="map-outline" size={18} color={COLORS.goldLight} />
                      <Text style={styles.secondaryActionText}>{t("hunts.lookAtMap")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.body}>
              {hunt.respawn ? (
                <View style={styles.inlineFact}>
                  <Ionicons name="time-outline" size={16} color={COLORS.goldLight} />
                  <Text style={styles.blockText}>{t("hunts.respawn")}: {hunt.respawn}</Text>
                </View>
              ) : null}

              {hunt.description ? <Text style={styles.description}>{hunt.description}</Text> : null}

              {vocations.length ? (
                <>
                  <Text style={styles.section}>{t("hunts.vocations")}</Text>
                  {vocations.map((entry, index) => {
                    const levelLabel = formatLevelRange(entry.levelMin, entry.levelMax);
                    const xpLabel = formatRate(entry.xpPerHour);
                    const profitLabel = formatRate(entry.profitPerHour);
                    return (
                      <View key={`${entry.vocation || "voc"}-${index}`} style={styles.vocationRow}>
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
                      <Pressable
                        key={creature.id || creature.name}
                        onPress={() => router.push("/(tabs)/bestiary")}
                        style={({ pressed }) => [styles.creatureRow, pressed && styles.pressed]}
                      >
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
                          <View style={styles.bestiaryLink}>
                            <Text style={styles.bestiaryText}>{t("hunts.openBestiary")}</Text>
                            <Ionicons name="chevron-forward" size={14} color={COLORS.goldLight} />
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
                      </Pressable>
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

              <View style={styles.community}>
                <View style={styles.communityHead}>
                  <View style={styles.communityTitleCopy}>
                    <Text style={styles.section}>{t("hunts.community")}</Text>
                    <Text style={styles.communityHint}>{t("hunts.communityUnavailable")}</Text>
                  </View>
                  <Pressable disabled style={styles.likeButton}>
                    <Ionicons name="heart-outline" size={18} color={COLORS.textMuted} />
                    <Text style={styles.disabledText}>{t("hunts.likeHunt")}</Text>
                  </Pressable>
                </View>
                <View style={styles.communityCounts}>
                  <Text style={styles.countText}>{t("hunts.likesUnavailable")}</Text>
                  <Text style={styles.countText}>{t("hunts.commentsUnavailable")}</Text>
                </View>
                <View style={styles.composer}>
                  <TextInput
                    editable={false}
                    placeholder={t("hunts.commentPlaceholder")}
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.commentInput}
                  />
                  <Pressable disabled style={styles.sendButton}>
                    <Ionicons name="send-outline" size={17} color={COLORS.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.textMuted} />
                  <Text style={styles.communityHint}>{t("hunts.noCommentsAvailable")}</Text>
                  <Text style={styles.replyHint}>{t("hunts.replyUnavailable")}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {hunt ? (
          <HuntMapScreen
            visible={mapOpen}
            title={t("hunts.mapTitle", { name: hunt.name })}
            source={mapSource}
            onClose={() => setMapOpen(false)}
          />
        ) : null}
      </ImageBackground>
    </AppScreen>
  );
}

function HeroStat({ label, value, accent }) {
  if (!value) return null;
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={[styles.heroStatValue, accent && styles.heroStatAccent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 120 },
  hero: {
    width: "100%",
    minHeight: 475,
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: COLORS.bg,
  },
  heroArt: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: "absolute",
    top: 14,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,11,20,0.48)",
  },
  heroContent: { paddingHorizontal: 18, paddingBottom: 22, paddingTop: 76, gap: 8 },
  eyebrow: {
    color: COLORS.goldLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  name: { color: COLORS.text, fontSize: 29, lineHeight: 34, fontWeight: "900" },
  location: { color: "#d6deea", fontSize: 13, fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  badge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(7,11,20,0.58)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(240,199,94,0.30)",
  },
  heroStats: {
    flexDirection: "row",
    marginTop: 7,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248,250,252,0.16)",
  },
  heroStat: { flex: 1, minWidth: 0 },
  heroStatLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroStatValue: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginTop: 3 },
  heroStatAccent: { color: "#8bddaa" },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 5 },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
  },
  primaryActionText: { color: COLORS.bg, fontSize: 12, fontWeight: "900" },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(7,11,20,0.64)",
    borderWidth: 1,
    borderColor: "rgba(240,199,94,0.38)",
  },
  secondaryActionText: { color: COLORS.goldLight, fontSize: 12, fontWeight: "900" },
  body: { paddingHorizontal: 18, paddingTop: 18, gap: 8 },
  inlineFact: { flexDirection: "row", alignItems: "center", gap: 8 },
  description: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 4 },
  section: {
    color: COLORS.goldLight,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 3,
  },
  blockText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  vocationRow: {
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.16)",
  },
  vocationName: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  creatureRow: {
    gap: 7,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.16)",
  },
  creatureLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatureImg: { width: 48, height: 48 },
  creatureInfo: { flex: 1, minWidth: 0, gap: 4 },
  creatureName: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  creatureMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bestiaryLink: { flexDirection: "row", alignItems: "center", gap: 1 },
  bestiaryText: { color: COLORS.goldLight, fontSize: 10, fontWeight: "800" },
  metaChip: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  iconLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dmgRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  dmgIcon: { width: 18, height: 18 },
  elementIcon: { width: 22, height: 22 },
  lootRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.16)",
  },
  lootImg: { width: 32, height: 32 },
  lootInfo: { flex: 1, minWidth: 0, gap: 2 },
  ytIcon: { width: 22, height: 22 },
  community: {
    marginTop: 22,
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,167,44,0.30)",
  },
  communityHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  communityTitleCopy: { flex: 1, minWidth: 0 },
  communityHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  likeButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  disabledText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  communityCounts: { flexDirection: "row", gap: 14, marginTop: 12 },
  countText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.24)",
  },
  commentInput: { flex: 1, color: COLORS.textMuted, paddingVertical: 9, fontSize: 13 },
  sendButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  emptyComments: { alignItems: "center", gap: 7, paddingVertical: 24 },
  replyHint: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, padding: 18, gap: 12, justifyContent: "center" },
  missingText: { color: COLORS.text },
  backText: { color: COLORS.goldLight, fontWeight: "800" },
});
