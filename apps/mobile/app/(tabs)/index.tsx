import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/src/store/AppStore";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Spacing, Type } from "@/constants/theme";

const appIcon = require("@/assets/ui/runescodex-icon.png");
const homeBg = require("@/assets/runescodex/home/home_background.webp");
const iconBestiary = require("@/assets/runescodex/home/bestiario.png");
const iconHunts = require("@/assets/runescodex/home/hunt.png");
const iconForum = require("@/assets/runescodex/home/forum.png");
const iconRewards = require("@/assets/runescodex/home/rewards.png");
const iconTracker = require("@/assets/runescodex/home/tracker.png");
const iconMusic = require("@/assets/runescodex/home/music.png");
const iconServices = require("@/assets/runescodex/home/services.png");

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

const FEATURED = [
  {
    id: "h2",
    name: "Dragon Hunt",
    vocation: "MS",
    levelMin: 80,
    image: require("@/assets/runescodex/creatures/Dragon.gif"),
  },
  {
    id: "h3",
    name: "Hydra Hunt",
    vocation: "RP",
    levelMin: 150,
    image: require("@/assets/runescodex/creatures/Hydra.gif"),
  },
  {
    id: "h1",
    name: "Cyclops Hunt",
    vocation: "EK",
    levelMin: 40,
    image: require("@/assets/runescodex/creatures/Cyclops.gif"),
  },
];

const dailyRewards: { id: string; done?: boolean }[] = [];
const weeklyRewards: { id: string; done?: boolean }[] = [];
const monthlyRewards: { id: string; done?: boolean }[] = [];

const FLAGS: Record<string, string> = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
  pl: "🇵🇱",
};

const SHORTCUTS_ROW1 = [
  { key: "bestiary", path: "/(tabs)/bestiary", image: iconBestiary },
  { key: "hunts", path: "/(tabs)/hunts", image: iconHunts },
  { key: "forum", path: "/(tabs)/forum", image: iconForum },
  { key: "rewards", path: "/(tabs)/shop", image: iconRewards },
];

const SHORTCUTS_ROW2 = [
  { key: "tracker", path: "/(tabs)/tracker", image: iconTracker },
  { key: "music", path: "/(tabs)/music", image: iconMusic },
  { key: "services", path: "/(tabs)/services", image: iconServices },
];

function bannerAspectRatio(source: number) {
  const meta = Image.resolveAssetSource(source);
  if (!meta?.width || !meta?.height) return 16 / 9;
  return meta.width / meta.height;
}

function progressOf(items: { done?: boolean }[]) {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return { done, total };
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
  const { points } = useAppStore();
  const { activeCharacter } = useAuth();
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

  const rewardGroups = [
    {
      key: "daily",
      icon: "sunny-outline" as const,
      title: t("home.rewardsDaily"),
      hint: t("home.rewardsDailyHint"),
      ...progressOf(dailyRewards),
    },
    {
      key: "weekly",
      icon: "calendar-outline" as const,
      title: t("home.rewardsWeekly"),
      hint: t("home.rewardsWeeklyHint"),
      ...progressOf(weeklyRewards),
    },
    {
      key: "monthly",
      icon: "trophy-outline" as const,
      title: t("home.rewardsMonthly"),
      hint: t("home.rewardsMonthlyHint"),
      ...progressOf(monthlyRewards),
    },
  ];

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
            <View style={styles.shortcutRow}>
              {SHORTCUTS_ROW1.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.path as any)}
                  style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
                >
                  <Image source={item.image} style={styles.shortcutImage} resizeMode="contain" />
                  <Text style={styles.shortcutTitle}>{t(`home.${item.key}`)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.shortcutRowCenter}>
              {SHORTCUTS_ROW2.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => router.push(item.path as any)}
                  style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
                >
                  <Image source={item.image} style={styles.shortcutImage} resizeMode="contain" />
                  <Text style={styles.shortcutTitle}>{t(`home.${item.key}`)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.section}>{t("home.featuredHunts")}</Text>
            {FEATURED.map((hunt) => (
              <Pressable
                key={hunt.id}
                onPress={() => router.push("/(tabs)/hunts" as any)}
                style={({ pressed }) => [styles.reco, pressed && styles.pressed]}
              >
                <Image source={hunt.image} style={styles.recoImage} resizeMode="contain" />
                <View style={styles.recoCopy}>
                  <Text style={styles.recoTitle}>{hunt.name}</Text>
                  <Text style={styles.recoMeta}>
                    {hunt.vocation} • Lvl {hunt.levelMin}
                  </Text>
                  <Text style={styles.recoLink}>{t("home.openHunt")} ›</Text>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={() => router.push("/(tabs)/shop" as any)}
              style={({ pressed }) => [styles.rewardsWrap, pressed && styles.pressed]}
            >
              <View style={styles.rewardsHead}>
                <Text style={styles.sectionInline}>{t("home.rewardsTitle")}</Text>
                <Text style={styles.rewardsPoints}>
                  {t("home.points")}: {points ?? 0}
                </Text>
              </View>
              {rewardGroups.map((group, index) => {
                const ratio = group.total > 0 ? group.done / group.total : 0;
                return (
                  <View key={group.key} style={index > 0 ? styles.rewardsBlock : undefined}>
                    <View style={styles.rewardsRow}>
                      <Ionicons name={group.icon} size={18} color={Colors.goldLight} />
                      <View style={styles.rewardsCopy}>
                        <Text style={styles.rewardsCat}>{group.title}</Text>
                        <Text style={styles.rewardsHint}>{group.hint}</Text>
                      </View>
                      <Text style={styles.rewardsCount}>
                        {group.total > 0 ? `${group.done}/${group.total}` : "—"}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.trackFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                  </View>
                );
              })}
              <Text style={styles.rewardsCta}>{t("home.rewardsCta")} ›</Text>
            </Pressable>
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
  shortcutRow: { flexDirection: "row", justifyContent: "space-between" },
  shortcutRowCenter: { flexDirection: "row", justifyContent: "center", gap: 8 },
  shortcut: {
    width: "24%",
    alignItems: "center",
    gap: 6,
  },
  shortcutImage: { width: 72, height: 72 },
  shortcutTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.tiny, textAlign: "center" },
  reco: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  recoImage: { width: 56, height: 56 },
  recoCopy: { flex: 1, gap: 3 },
  recoTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.card },
  recoMeta: { color: Colors.textSecondary, fontSize: Type.secondary },
  recoLink: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.tiny },
  rewardsWrap: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  rewardsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  rewardsPoints: { color: Colors.goldLight, fontSize: Type.card, fontWeight: "800" },
  rewardsBlock: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(212,167,44,0.22)",
  },
  rewardsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rewardsCopy: { flex: 1, minWidth: 0 },
  rewardsCat: {
    color: Colors.goldLight,
    fontWeight: "800",
    fontSize: Type.card,
    letterSpacing: 0.6,
  },
  rewardsHint: { color: Colors.textSecondary, fontSize: Type.tiny, marginTop: 2 },
  rewardsCount: { color: Colors.text, fontWeight: "800", fontSize: Type.secondary },
  track: {
    height: 3,
    borderRadius: 99,
    backgroundColor: "rgba(248,250,252,0.12)",
    marginTop: 8,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 99,
  },
  rewardsCta: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.secondary, marginTop: 2 },
  pressed: { opacity: 0.92 },
});
