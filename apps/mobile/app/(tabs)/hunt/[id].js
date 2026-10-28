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
  const videos = hunt?.videos || [];
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
                  <HeroStat label={t("hunts.xpH")} value={heroXp} iconLabel="XP" />
                  <HeroStat label={t("hunts.profitH")} value={heroProfit} accent iconLabel="GP" />
                  <HeroStat label={t("hunts.creatures")} value={spawn.length ? String(spawn.length) : null} iconLabel="N" />
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
              {(hunt.displayLocation || hunt.respawn || hunt.difficulty || heroLevel) ? (
                <View style={styles.infoPanel}>
                  <InfoRow icon="location-outline" label={t("hunts.location")} value={hunt.displayLocation} last={!hunt.respawn && !hunt.difficulty && !heroLevel} />
                  <InfoRow icon="time-outline" label={t("hunts.respawn")} value={hunt.respawn} last={!hunt.difficulty && !heroLevel} />
                  <InfoRow icon="shield-outline" label={t("hunts.difficulty")} value={hunt.difficulty ? formatDifficultyLabel(hunt.difficulty) : null} last={!heroLevel} />
                  <InfoRow icon="trending-up-outline" label={t("hunts.level")} value={heroLevel} last />
                </View>
              ) : null}

              {hunt.description ? <Text style={styles.description}>{hunt.description}</Text> : null}

              {vocations.length ? (
                <>
                  <SectionTitle mark="⚔">{t("hunts.vocations")}</SectionTitle>
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
                  <SectionTitle mark="⚔">{t("hunts.creatures")}</SectionTitle>
                  {spawn.map((creature) => {
                    const hpLabel = formatCount(creature.hp);
                    const xpLabel = formatCount(creature.xp);
                    const charm = creature.recommendedCharm;
                    const charmImage = charm ? charmIcon(charm) : null;
                    return (
                      <Pressable
                        key={creature.id || creature.name}
                        onPress={() => router.push("/(tabs)/bestiary")}
                        style={({ pressed }) => [styles.creatureCard, pressed && styles.pressed]}
                      >
                        <View style={styles.creatureLine}>
                          {creature.image ? (
                            <View style={styles.creatureImgWrap}>
                              <Image source={creature.image} style={styles.creatureImg} resizeMode="contain" />
                            </View>
                          ) : null}
                          <View style={styles.creatureInfo}>
                            <Text style={styles.creatureName} numberOfLines={2}>
                              {creature.name}
                              {creature.isPrimary ? `  ·  ${t("hunts.primary")}` : ""}
                            </Text>
                            <View style={styles.creatureMeta}>
                              {hpLabel ? (
                                <View style={styles.metaChipWrap}>
                                  <Text style={styles.metaChipLabel}>{t("hunts.hp")}</Text>
                                  <Text style={styles.metaChip}>{hpLabel}</Text>
                                </View>
                              ) : null}
                              {xpLabel ? (
                                <View style={styles.metaChipWrap}>
                                  <Text style={styles.metaChipLabel}>{t("hunts.xp")}</Text>
                                  <Text style={styles.metaChip}>{xpLabel}</Text>
                                </View>
                              ) : null}
                              {creature.quantity != null ? (
                                <View style={styles.metaChipWrap}>
                                  <Text style={styles.metaChipLabel}>{t("hunts.quantity")}</Text>
                                  <Text style={styles.metaChip}>{creature.quantity}</Text>
                                </View>
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
                  <SectionTitle mark="▤">{t("hunts.elements")}</SectionTitle>
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
                  <SectionTitle mark="▣">{t("hunts.mainLoot")}</SectionTitle>
                  {loot.map((item) => {
                    const valueLabel = hasNumericValue(item.estimatedValue)
                      ? formatRate(item.estimatedValue)
                      : null;
                    return (
                      <View key={item.id || item.itemName} style={styles.lootCard}>
                        {item.image ? (
                          <View style={styles.lootImgWrap}>
                            <Image source={item.image} style={styles.lootImg} resizeMode="contain" />
                          </View>
                        ) : null}
                        <View style={styles.lootInfo}>
                          <Text style={styles.lootName} numberOfLines={2}>
                            {item.itemName}
                          </Text>
                          {valueLabel ? (
                            <View style={styles.lootValueRow}>
                              <Ionicons name="cash-outline" size={12} color={COLORS.goldLight} />
                              <Text style={styles.lootValue}>{valueLabel}</Text>
                            </View>
                          ) : null}
                          {item.importance ? (
                            <Text style={styles.metaChip}>{item.importance}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}

              {videos.length > 1 ? (
                <>
                  <SectionTitle mark="▶">{t("hunts.videos")}</SectionTitle>
                  {videos.map((video) => (
                    <Pressable
                      key={video.id}
                      onPress={() => openUrl(video.url)}
                      style={({ pressed }) => [styles.videoCard, pressed && styles.pressed]}
                    >
                      <View style={styles.videoCardIcon}>
                        <Ionicons name="play-circle-outline" size={26} color="#ff7474" />
                      </View>
                      <View style={styles.videoCardInfo}>
                        {video.title ? (
                          <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                        ) : null}
                        {video.channel ? (
                          <Text style={styles.videoChannel}>{video.channel}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.watchLabel}>{t("hunts.watchVideo")}</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}

              <View style={styles.community}>
                <View style={styles.communityHead}>
                  <View style={styles.communityTitleCopy}>
                    <SectionTitle mark="●">{t("hunts.community")}</SectionTitle>
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

function HeroStat({ label, value, accent, iconLabel }) {
  if (!value) return null;
  return (
    <View style={styles.heroStat}>
      {iconLabel ? (
        <View style={[styles.kpiIconBox, accent && styles.kpiIconBoxAccent]}>
          <Text style={[styles.kpiIconText, accent && styles.kpiIconTextAccent]}>{iconLabel}</Text>
        </View>
      ) : null}
      <View style={styles.kpiTextBlock}>
        <Text style={styles.heroStatLabel}>{label}</Text>
        <Text style={[styles.heroStatValue, accent && styles.heroStatAccent]}>{value}</Text>
      </View>
    </View>
  );
}

function SectionTitle({ children, mark = "◆" }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionMark}>{mark}</Text>
      <Text style={styles.section}>{children}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  if (!value) return null;
  return (
    <View style={[styles.infoRowItem, last && styles.infoRowLast]}>
      <View style={styles.infoLabelWrap}>
        <Ionicons name={icon} size={13} color={COLORS.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#020811" },
  content: { paddingBottom: 120 },
  hero: {
    width: "100%",
    minHeight: 490,
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: "#020811",
  },
  heroArt: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: "absolute",
    top: 14,
    left: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,12,22,0.84)",
    borderWidth: 1,
    borderColor: "rgba(242,183,47,0.42)",
  },
  heroContent: { paddingHorizontal: 18, paddingBottom: 24, paddingTop: 76, gap: 10 },
  eyebrow: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  name: { color: COLORS.text, fontSize: 30, lineHeight: 34, fontWeight: "900" },
  location: { color: "#a9c8f4", fontSize: 13, fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
  badge: {
    color: "#b8d0ef",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(5,19,32,0.82)",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.9)",
  },
  heroStats: {
    flexDirection: "row",
    marginTop: 9,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248,250,252,0.14)",
    gap: 2,
  },
  heroStat: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,137,214,0.22)",
    borderWidth: 1,
    borderColor: "rgba(7,137,214,0.38)",
  },
  kpiIconBoxAccent: {
    backgroundColor: "rgba(139,221,170,0.16)",
    borderColor: "rgba(139,221,170,0.32)",
  },
  kpiIconText: {
    color: "#79aef0",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  kpiIconTextAccent: { color: "#8bddaa" },
  kpiTextBlock: { flex: 1, minWidth: 0 },
  heroStatLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroStatValue: { color: COLORS.text, fontSize: 16, fontWeight: "900", marginTop: 2 },
  heroStatAccent: { color: "#8bddaa" },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 6 },
  primaryAction: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#c92222",
    borderWidth: 1,
    borderColor: "#e33b3b",
  },
  primaryActionText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(5,19,32,0.9)",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.58)",
  },
  secondaryActionText: { color: COLORS.goldLight, fontSize: 12, fontWeight: "900" },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },
  // Info panel (label → value rows)
  infoPanel: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.8)",
    backgroundColor: "rgba(4,15,27,0.72)",
    marginBottom: 4,
  },
  infoRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(24,55,80,0.56)",
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  infoLabel: { color: "#9dbce2", fontSize: 13, fontWeight: "600" },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: "800", textAlign: "right", flexShrink: 1, marginLeft: 12 },
  description: { color: "#9eb1c7", fontSize: 14, lineHeight: 22, marginVertical: 4 },
  // Section titles with mark
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 6 },
  sectionMark: { color: COLORS.goldLight, fontSize: 10, fontWeight: "900" },
  section: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  blockText: { color: "#9eb1c7", fontSize: 13, lineHeight: 18, flexShrink: 1 },
  // Vocation rows
  vocationRow: {
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "rgba(5,19,32,0.72)",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.72)",
  },
  vocationName: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  // Creature cards (panel style)
  creatureCard: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: "rgba(5,19,32,0.82)",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.9)",
  },
  creatureLine: { flexDirection: "row", alignItems: "center", gap: 12 },
  creatureImgWrap: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.36)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.6)",
  },
  creatureImg: { width: 60, height: 60 },
  creatureInfo: { flex: 1, minWidth: 0, gap: 5 },
  creatureName: { color: COLORS.text, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  creatureMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChipWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(24,55,80,0.56)",
  },
  metaChipLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700" },
  metaChip: { color: "#b8d0ef", fontSize: 11, fontWeight: "800" },
  bestiaryLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  bestiaryText: { color: COLORS.goldLight, fontSize: 10, fontWeight: "800" },
  iconLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dmgRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  dmgIcon: { width: 18, height: 18 },
  elementIcon: { width: 22, height: 22 },
  // Loot cards
  lootCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "rgba(5,19,32,0.72)",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.72)",
  },
  lootImgWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.36)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.5)",
  },
  lootImg: { width: 38, height: 38 },
  lootInfo: { flex: 1, minWidth: 0, gap: 4 },
  lootName: { color: COLORS.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
  lootValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  lootValue: { color: COLORS.goldLight, fontSize: 12, fontWeight: "800" },
  ytIcon: { width: 22, height: 22 },
  // Videos
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "rgba(113,50,56,0.32)",
    borderWidth: 1,
    borderColor: "rgba(113,50,56,0.72)",
  },
  videoCardIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  videoCardInfo: { flex: 1, minWidth: 0, gap: 3 },
  videoTitle: { color: COLORS.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
  videoChannel: { color: "#ff7474", fontSize: 11, fontWeight: "700" },
  watchLabel: { color: "#ff7474", fontSize: 11, fontWeight: "900" },
  // Community
  community: {
    marginTop: 18,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(24,55,80,0.9)",
    backgroundColor: "rgba(4,15,27,0.72)",
  },
  communityHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  communityTitleCopy: { flex: 1, minWidth: 0 },
  communityHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  likeButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  disabledText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  communityCounts: { flexDirection: "row", gap: 14, marginTop: 12 },
  countText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(4,13,23,0.8)",
    paddingHorizontal: 12,
  },
  commentInput: { flex: 1, color: COLORS.textMuted, paddingVertical: 9, fontSize: 13 },
  sendButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyComments: { alignItems: "center", gap: 7, paddingVertical: 24 },
  replyHint: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  missing: { flex: 1, padding: 18, gap: 12, justifyContent: "center" },
  missingText: { color: COLORS.text },
  backText: { color: COLORS.goldLight, fontWeight: "800" },
});
