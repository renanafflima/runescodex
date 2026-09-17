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
  DAMAGE_ICONS,
  PTS,
  damageIcon,
  formatRate,
  getHuntHero,
  huntElements,
  huntsBackground,
  mapHuntDetail,
  resolveMapImage,
} from "@/src/data/hunts";

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

export default function HuntDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const slug = Array.isArray(id) ? id[0] : id;
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [tipVotes, setTipVotes] = useState({});
  const [showAllTips, setShowAllTips] = useState(false);

  const loadHunt = useCallback(async () => {
    if (!slug) {
      setHunt(null);
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

  const elements = useMemo(() => (hunt ? huntElements(hunt) : []), [hunt]);
  const tips = hunt?.communityTips || [];
  const visibleTips = showAllTips ? tips : tips.slice(0, 2);
  const loot = (hunt?.loot || []).filter(Boolean);
  const videoUrl = hunt?.youtubeUrl;

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.missing}>
          <ActivityIndicator color={COLORS.goldLight} />
        </View>
      </AppScreen>
    );
  }

  if (!hunt) {
    return (
      <AppScreen>
        <View style={styles.missing}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backText}>{t("common.back")}</Text>
          </Pressable>
          <Text style={styles.missingText}>{error || t("hunts.empty")}</Text>
        </View>
      </AppScreen>
    );
  }

  const mapSource = resolveMapImage(hunt.mapImage, hunt.creature);

  function vote(tipId, kind) {
    setTipVotes((prev) => ({ ...prev, [tipId]: kind }));
  }

  return (
    <AppScreen>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(7,11,20,0.2)", "rgba(7,11,20,0.88)"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View>
            <Image source={getHuntHero(hunt)} style={styles.hero} resizeMode="cover" />
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.name}>{hunt.name}</Text>
            <Text style={styles.location}>{hunt.location}</Text>

            <Text style={styles.stat}>
              {formatRate(hunt.xpH)} {t("hunts.xpH")}
            </Text>
            <Text style={styles.stat}>
              {formatRate(hunt.profitH)} {t("hunts.profitH")}
            </Text>
            <Text style={styles.ptLine}>
              {PTS.map((mult) => `PT x${mult} ${formatRate(Number(hunt.xpH) * mult)}/${formatRate(Number(hunt.profitH) * mult)}`).join("   ")}
            </Text>

            {hunt.respawn ? (
              <Text style={styles.blockText}>
                {t("hunts.respawn")}: {hunt.respawn}
              </Text>
            ) : null}

            <Text style={styles.section}>{t("hunts.creatures")}</Text>
            {(hunt.spawn || []).map((creature) => (
              <View key={creature.name} style={styles.creatureLine}>
                {creature.image ? (
                  <Image source={creature.image} style={styles.creatureImg} resizeMode="contain" />
                ) : (
                  <View style={styles.creatureImg} />
                )}
                <Text style={styles.creatureName}>
                  {creature.name}
                  {creature.recommendedCharm ? `  ${creature.recommendedCharm}` : ""}
                </Text>
                <View style={styles.dmgRow}>
                  {(creature.weaknesses || []).map((type) => {
                    const icon = damageIcon(type);
                    if (!icon) return null;
                    return <Image key={`${creature.name}-${type}`} source={icon} style={styles.dmgIcon} resizeMode="contain" />;
                  })}
                </View>
              </View>
            ))}

            {elements.length ? (
              <>
                <Text style={styles.section}>{t("hunts.elements")}</Text>
                <View style={styles.dmgRow}>
                  {elements.map((key) => (
                    <Image key={key} source={DAMAGE_ICONS[key]} style={styles.elementIcon} resizeMode="contain" />
                  ))}
                </View>
              </>
            ) : null}

            {hunt.difficulty ? (
              <Text style={styles.blockText}>
                {t("bestiary.difficulty")}: {hunt.difficulty}
              </Text>
            ) : null}

            <Pressable onPress={() => setMapOpen(true)} style={styles.mapAction}>
              <Text style={styles.mapActionText}>{t("hunts.seeMap")}</Text>
            </Pressable>

            {loot.length ? (
              <>
                <Text style={styles.section}>{t("hunts.mainLoot")}</Text>
                {loot.map((item) => (
                  <Text key={item} style={styles.blockText}>
                    {item}
                  </Text>
                ))}
              </>
            ) : null}

            {videoUrl ? (
              <>
                <Text style={styles.section}>{t("hunts.videos")}</Text>
                <Pressable onPress={() => openUrl(videoUrl)}>
                  <Text style={styles.link}>{t("hunts.openYoutube")}</Text>
                </Pressable>
              </>
            ) : null}

            <Text style={styles.section}>{t("hunts.communityTips")}</Text>
            {visibleTips.length ? (
              visibleTips.map((tip) => {
                const voteState = tipVotes[tip.id];
                const likes = (tip.likes || 0) + (voteState === "up" ? 1 : 0);
                const dislikes = (tip.dislikes || 0) + (voteState === "down" ? 1 : 0);
                return (
                  <View key={tip.id} style={styles.tip}>
                    <View style={styles.tipHead}>
                      {tip.avatar ? (
                        <Image source={tip.avatar} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarFallback} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tipUser}>{tip.user}</Text>
                        {tip.createdAt ? <Text style={styles.tipTime}>{tip.createdAt}</Text> : null}
                      </View>
                    </View>
                    <Text style={styles.tipText}>“{tip.text}”</Text>
                    <View style={styles.votes}>
                      <Pressable onPress={() => vote(tip.id, "up")} style={styles.voteBtn}>
                        <Text style={styles.voteText}>👍 {likes}</Text>
                      </Pressable>
                      <Pressable onPress={() => vote(tip.id, "down")} style={styles.voteBtn}>
                        <Text style={styles.voteText}>👎 {dislikes}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.blockText}>{t("hunts.noTips")}</Text>
            )}
            {tips.length > 2 ? (
              <Pressable onPress={() => setShowAllTips((v) => !v)}>
                <Text style={styles.link}>{t("hunts.moreTips")}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

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
  name: { color: COLORS.text, fontSize: 26, fontWeight: "800" },
  location: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 6 },
  stat: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  ptLine: { color: COLORS.goldLight, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 2 },
  section: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 14,
  },
  blockText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  creatureLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatureImg: { width: 42, height: 42 },
  creatureName: { color: COLORS.text, flex: 1, fontWeight: "700" },
  dmgRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dmgIcon: { width: 18, height: 18 },
  elementIcon: { width: 22, height: 22 },
  mapAction: { marginTop: 16 },
  mapActionText: { color: COLORS.goldLight, fontWeight: "800", fontSize: 15 },
  link: { color: COLORS.goldLight, fontWeight: "800" },
  tip: { paddingTop: 10, gap: 6 },
  tipHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212,167,44,0.22)",
  },
  tipUser: { color: COLORS.text, fontWeight: "800" },
  tipTime: { color: COLORS.textMuted, fontSize: 11 },
  tipText: { color: COLORS.text, lineHeight: 20, fontSize: 14 },
  votes: { flexDirection: "row", gap: 16 },
  voteBtn: { paddingVertical: 4 },
  voteText: { color: COLORS.textSecondary, fontWeight: "700" },
  missing: { flex: 1, padding: 18, gap: 12 },
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
