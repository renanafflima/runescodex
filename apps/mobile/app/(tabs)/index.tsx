import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { getRewardsMe, listRewardMissions } from "@/src/api/rewards";
import { Colors, Spacing, Type } from "@/constants/theme";

const appIcon = require("@/assets/ui/runescodex-icon.png");
const homeBg = require("@/assets/runescodex/home/home_background.webp");
const iconBestiary = require("@/assets/runescodex/home/bestiario.png");
const iconHunts = require("@/assets/runescodex/home/hunt.png");
const iconForum = require("@/assets/runescodex/home/forum.png");
const iconRewards = require("@/assets/runescodex/home/rewards.png");

const HOME_BANNERS = [
  {
    id: "tritech-01",
    image: require("@/assets/runescodex/banners/home_banner_tritech_01.webp"),
    url: "",
  },
  {
    id: "tritech-02",
    image: require("@/assets/runescodex/banners/home_banner_tritech_02.webp"),
    url: "",
  },
  {
    id: "tritech-03",
    image: require("@/assets/runescodex/banners/home_banner_tritech_03.webp"),
    url: "",
  },
  {
    id: "tritech-04",
    image: require("@/assets/runescodex/banners/home_banner_tritech_04.webp"),
    url: "",
  },
  {
    id: "tritech-05",
    image: require("@/assets/runescodex/banners/home_banner_tritech_05.webp"),
    url: "",
  },
  {
    id: "propaganda-01",
    image: require("@/assets/runescodex/banners/home_banner_propaganda_01.webp"),
    url: "",
  },
  {
    id: "propaganda-02",
    image: require("@/assets/runescodex/banners/home_banner_propaganda_02.webp"),
    url: "",
  },
  {
    id: "propaganda-03",
    image: require("@/assets/runescodex/banners/home_banner_propaganda_03.webp"),
    url: "",
  },
  {
    id: "propaganda-04",
    image: require("@/assets/runescodex/banners/home_banner_propaganda_04.webp"),
    url: "",
  },
];

const MISSION_PERIODS = ["DAILY", "WEEKLY", "MONTHLY"] as const;

type HomeMission = {
  id: string;
  title?: string;
  period?: string;
  current?: number;
  target?: number;
  rewardPoints?: number;
  completed?: boolean;
};

const FLAGS: Record<string, string> = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  pl: "🇵🇱",
};

const SHORTCUTS = [
  { key: "bestiary", path: "/(tabs)/bestiary", image: iconBestiary },
  { key: "hunts", path: "/(tabs)/hunts", image: iconHunts },
  { key: "forum", path: "/(tabs)/forum", image: iconForum },
  { key: "rewards", path: "/(tabs)/shop", image: iconRewards },
];

function bannerAspectRatio(source: number) {
  const meta = Image.resolveAssetSource(source);
  if (!meta?.width || !meta?.height) return 16 / 9;
  return meta.width / meta.height;
}

function periodLabel(period: string | undefined, t: (key: string) => string) {
  if (period === "DAILY") return t("home.rewardsDaily");
  if (period === "WEEKLY") return t("home.rewardsWeekly");
  if (period === "MONTHLY") return t("home.rewardsMonthly");
  return "";
}

function mapOpenMission(row: HomeMission): HomeMission | null {
  if (!row?.id || row.completed === true) return null;
  return {
    id: String(row.id),
    title: row.title,
    period: row.period,
    current: Number.isFinite(Number(row.current)) ? Number(row.current) : undefined,
    target: Number.isFinite(Number(row.target)) ? Number(row.target) : undefined,
    rewardPoints: Number.isFinite(Number(row.rewardPoints)) ? Number(row.rewardPoints) : undefined,
    completed: false,
  };
}

async function openExternalUrl(url?: string) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(url);
  } catch {
    // ignore
  }
}

export default function HomeTab() {
  const router = useRouter();
  const { activeCharacter, token } = useAuth();
  const { t, locale, setLocale, locales } = useI18n();
  const screenW = Dimensions.get("window").width;
  const contentW = screenW - Spacing.lg * 2;
  const aspect = useMemo(
    () => Math.min(...HOME_BANNERS.map((item) => bannerAspectRatio(item.image))),
    []
  );
  const bannerH = Math.round(screenW / aspect);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollView>(null);
  const draggingRef = useRef(false);
  const [openMissions, setOpenMissions] = useState<HomeMission[]>([]);
  const [walletPoints, setWalletPoints] = useState<number | null>(null);
  const [missionsError, setMissionsError] = useState("");
  const rewardsRequestRef = useRef(0);
  const shortcutWidth = Math.floor((contentW - 10) / 2);
  const shortcutHeight = Math.max(124, Math.round(shortcutWidth * 0.78));

  const loadOpenMissions = useCallback(async () => {
    if (!token) return;
    const requestId = ++rewardsRequestRef.current;
    setMissionsError("");
    const describeError = (error: unknown) => {
      const status = (error as { status?: number })?.status;
      const code = (error as { code?: string })?.code;
      if (code === "NETWORK") return t("auth.networkError");
      if (status === 401) return t("auth.sessionExpired");
      return t("auth.genericError");
    };
    try {
      const me = await getRewardsMe(token);
      if (requestId !== rewardsRequestRef.current) return;
      const pointsValue = Number(me?.wallet?.points);
      setWalletPoints(Number.isFinite(pointsValue) ? pointsValue : null);

      const settled = await Promise.allSettled(
        MISSION_PERIODS.map((period) => listRewardMissions(token, period)),
      );
      if (requestId !== rewardsRequestRef.current) return;

      const open: HomeMission[] = [];
      let missionError: unknown = null;
      for (const result of settled) {
        if (result.status !== "fulfilled") {
          if (!missionError) missionError = result.reason;
          continue;
        }
        if (!Array.isArray(result.value)) continue;
        for (const row of result.value) {
          const mission = mapOpenMission(row as HomeMission);
          if (mission) open.push(mission);
        }
      }
      setOpenMissions(open);
      if (missionError && open.length === 0) setMissionsError(describeError(missionError));
    } catch (error) {
      if (requestId !== rewardsRequestRef.current) return;
      setOpenMissions([]);
      setWalletPoints(null);
      setMissionsError(describeError(error));
    }
  }, [t, token]);

  useFocusEffect(
    useCallback(() => {
      loadOpenMissions();
    }, [loadOpenMissions]),
  );

  useEffect(() => {
    if (HOME_BANNERS.length < 2) return;
    const timer = setInterval(() => {
      if (draggingRef.current) return;
      setBannerIndex((current) => {
        const next = (current + 1) % HOME_BANNERS.length;
        bannerRef.current?.scrollTo({ x: next * screenW, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [screenW]);

  function onBannerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / screenW);
    if (next !== bannerIndex && next >= 0 && next < HOME_BANNERS.length) {
      setBannerIndex(next);
    }
  }

  return (
    <View style={styles.root}>
      <Image source={homeBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(7,11,20,0.42)", "rgba(7,11,20,0.78)"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={appIcon} style={styles.logo} />
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t("home.title")}</Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {t("home.activeCharacter")}: {activeCharacter?.name || t("characters.noneActive")}
              </Text>
            </View>
            <View style={styles.flags}>
              {locales.map((item: { id: string; label: string }) => (
                <Pressable
                  key={item.id}
                  onPress={() => setLocale(item.id)}
                  style={[styles.flag, locale === item.id && styles.flagActive]}
                >
                  <Text style={styles.flagText}>{FLAGS[item.id] || item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.bannerBleed}>
            <ScrollView
              ref={bannerRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onScrollBeginDrag={() => {
                draggingRef.current = true;
              }}
              onScrollEndDrag={() => {
                draggingRef.current = false;
              }}
              onMomentumScrollEnd={onBannerScroll}
              scrollEventThrottle={16}
            >
              {HOME_BANNERS.map((banner) => (
                <Pressable
                  key={banner.id}
                  onPress={() => openExternalUrl(banner.url)}
                  style={{ width: screenW, height: bannerH }}
                >
                  <Image
                    source={banner.image}
                    style={{ width: screenW, height: bannerH }}
                    resizeMode="contain"
                  />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.dots} pointerEvents="none">
              {HOME_BANNERS.map((banner, index) => (
                <View
                  key={banner.id}
                  style={[styles.dot, index === bannerIndex && styles.dotActive]}
                />
              ))}
            </View>
          </View>

          <View style={{ width: contentW, alignSelf: "center", gap: 14 }}>
            <Text style={styles.section}>{t("home.shortcuts")}</Text>
            <View style={styles.shortcutGrid}>
              {SHORTCUTS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.path as any)}
                  style={({ pressed }) => [
                    styles.shortcut,
                    { width: shortcutWidth, height: shortcutHeight },
                    pressed && styles.pressed,
                  ]}
                >
                  <Image source={item.image} style={styles.shortcutImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(7,11,20,0)", "rgba(7,11,20,0.58)"]}
                    style={styles.shortcutShade}
                    pointerEvents="none"
                  />
                  <Text style={styles.shortcutTitleGlow} numberOfLines={2}>
                    {t(`home.${item.key}`)}
                  </Text>
                  <Text style={styles.shortcutTitle} numberOfLines={2}>
                    {t(`home.${item.key}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.rewardsWrap}>
              <View style={styles.rewardsHead}>
                <Text style={styles.sectionInline}>{t("home.rewardsTitle")}</Text>
                {walletPoints != null ? (
                  <Text style={styles.rewardsPoints}>
                    {t("home.points")}: {walletPoints}
                  </Text>
                ) : null}
              </View>
              {missionsError ? <Text style={styles.missionsError}>{missionsError}</Text> : null}
              {openMissions.map((mission) => {
                const period = periodLabel(mission.period, t);
                const hasProgress =
                  mission.current != null && mission.target != null && mission.target > 0;
                const hasPoints = mission.rewardPoints != null;
                return (
                  <Pressable
                    key={`${mission.period || "mission"}-${mission.id}`}
                    onPress={() => router.push("/(tabs)/shop" as any)}
                    style={({ pressed }) => [styles.missionRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.missionTitle} numberOfLines={2}>
                      {mission.title || ""}
                    </Text>
                    <Text style={styles.missionMeta} numberOfLines={2}>
                      {[
                        period,
                        hasProgress ? `${mission.current}/${mission.target}` : "",
                        hasPoints ? `${mission.rewardPoints} pts` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => router.push("/(tabs)/shop" as any)}>
                <Text style={styles.rewardsCta}>{t("home.rewardsCta")} ›</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1, backgroundColor: "transparent" },
  content: { paddingBottom: 110, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
  },
  logo: { width: 44, height: 44, borderRadius: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: Colors.text, fontSize: Type.section, fontWeight: "800" },
  headerMeta: { color: Colors.textSecondary, fontSize: Type.tiny, marginTop: 2 },
  flags: { flexDirection: "row", gap: 4 },
  flag: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  flagActive: {
    borderColor: "rgba(212,167,44,0.7)",
    backgroundColor: "rgba(212,167,44,0.12)",
  },
  flagText: { fontSize: 14 },
  bannerBleed: { width: "100%" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(248,250,252,0.28)",
  },
  dotActive: { backgroundColor: Colors.goldLight, width: 14 },
  section: { color: Colors.text, fontSize: Type.section, fontWeight: "800", marginTop: 4 },
  sectionInline: { color: Colors.text, fontSize: Type.section, fontWeight: "800" },
  shortcutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcut: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.28)",
    backgroundColor: "#0b1220",
    justifyContent: "flex-end",
  },
  shortcutImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  shortcutShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "46%",
  },
  shortcutTitleGlow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 12,
    textAlign: "center",
    color: "rgba(240,199,112,0.28)",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    textShadowColor: "rgba(240,199,112,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  shortcutTitle: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 12,
    textAlign: "center",
    color: "#f6f1e6",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    textShadowColor: "rgba(0,0,0,0.92)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rewardsWrap: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  rewardsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  rewardsPoints: { color: Colors.goldLight, fontSize: Type.card, fontWeight: "800" },
  missionRow: {
    gap: 3,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,167,44,0.22)",
  },
  missionTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.card },
  missionMeta: { color: Colors.textSecondary, fontSize: Type.tiny },
  missionsError: { color: Colors.danger, fontSize: Type.secondary },
  rewardsCta: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.secondary, marginTop: 2 },
  pressed: { opacity: 0.92 },
});
