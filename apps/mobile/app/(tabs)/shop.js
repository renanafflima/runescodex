import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { useAuth } from "@/src/auth/AuthContext";
import { createLatestRequest } from "@/src/runtime/focusWork";
import { useI18n } from "@/src/i18n";
import {
  convertRewards,
  getRewardsMe,
  listRewardCatalog,
  listRewardMissions,
  listRewardRedemptions,
  redeemReward,
} from "@/src/api/rewards";
import {
  affordancePercent,
  chunkRows,
  finiteCount,
  formatPoints,
  formatRenewal,
  mapDiamondOffers,
  isPlayableRewardMission,
  mapGoldPackages,
  missionActivityPath,
  missionProgressPercent,
  periodWindow,
} from "@/src/domain/rewards";

const GOLD = "#d9ad3f";
const GOLD2 = "#f3d77a";
const BLUE = "#2ca9ff";
const BLUE2 = "#79d0ff";

const REWARDS_ASSETS = {
  background: require("../../assets/Rewars/assets/rewards_background.webp"),
  hero: require("../../assets/Rewars/assets/rewards_hero.webp"),
  bestiary: require("../../assets/Rewars/assets/bestiario.png"),
  exploration: require("../../assets/Rewars/assets/exploracao.png"),
  community: require("../../assets/Rewars/assets/comunidade.png"),
  hunt: require("../../assets/Rewars/assets/hunt.png"),
  recruitment: require("../../assets/Rewars/assets/recrutamento.png"),
  promotion: require("../../assets/Rewars/assets/divulgacao.png"),
  knowledge: require("../../assets/Rewars/assets/conhecimento.png"),
  music: require("../../assets/Rewars/assets/musica.png"),
  missionBestiary: require("../../assets/Rewars/assets/mission_bestiario.png"),
  missionExploration: require("../../assets/Rewars/assets/mission_exploracao.png"),
  missionForum: require("../../assets/Rewars/assets/mission_forum.png"),
  missionHunts: require("../../assets/Rewars/assets/mission_hunts.png"),
  gold1: require("../../assets/Rewars/assets/1goldcoin.png"),
  gold5: require("../../assets/Rewars/assets/5goldcoin.png"),
  diamond1: require("../../assets/Rewars/assets/1Diamond.png"),
  diamond3: require("../../assets/Rewars/assets/3diamonds.png"),
  tc125: require("../../assets/Rewars/assets/125tc.png"),
  tc250: require("../../assets/Rewars/assets/250tc.png"),
  rc500: require("../../assets/Rewars/assets/500rc.png"),
  rc1000: require("../../assets/Rewars/assets/1000rc.png"),
  ferumbrasHat: require("../../assets/Rewars/assets/ferumbrashat.png"),
};

const MISSION_CARD_BY_CATEGORY = {
  BESTIARY: "missionBestiary",
  EXPLORATION: "missionExploration",
  COMMUNITY: "missionForum",
  HUNT: "missionHunts",
  RECRUITMENT: "recruitment",
  PROMOTION: "promotion",
  KNOWLEDGE: "knowledge",
  MUSIC: "music",
};

const PERIOD_TABS = [
  { id: "DAILY", labelKey: "rewardsScreen.daily", oneKey: "rewardsScreen.dailyOne" },
  { id: "WEEKLY", labelKey: "rewardsScreen.weekly", oneKey: "rewardsScreen.weeklyOne" },
  { id: "MONTHLY", labelKey: "rewardsScreen.monthly", oneKey: "rewardsScreen.monthlyOne" },
];

const PACKAGE_COPY = {
  gold1: {
    kicker: "rewardsScreen.standard",
    title: "rewardsScreen.gold1Title",
    hint: "rewardsScreen.gold1Hint",
  },
  gold5: {
    kicker: "rewardsScreen.bonusPack",
    title: "rewardsScreen.gold5Title",
    hint: "rewardsScreen.gold5Hint",
  },
  diamond1: {
    kicker: "rewardsScreen.permanentCoin",
    title: "rewardsScreen.diamond1Title",
    hint: "rewardsScreen.diamond1Hint",
  },
  diamond3: {
    kicker: "rewardsScreen.pack",
    title: "rewardsScreen.diamond3Title",
    hint: "rewardsScreen.diamond3Hint",
  },
};

const REWARD_ERROR_KEYS = {
  "Insufficient points": "rewardsScreen.insufficientPoints",
  "Insufficient gold": "rewardsScreen.insufficientGold",
  "Insufficient diamond": "rewardsScreen.insufficientDiamond",
  "Gold to Diamond conversion is not configured": "rewardsScreen.diamondRateMissing",
  "Reward price is not configured": "rewardsScreen.priceNotConfigured",
  "Reward is inactive": "rewardsScreen.rewardInactive",
  "Reward not found": "rewardsScreen.rewardNotFound",
  "Invalid conversion amount. Allowed values: 1, 5": "rewardsScreen.invalidConversion",
  "Premium required": "rewardsScreen.premiumRequired",
};

const IMAGE_ALIASES = {
  mission_exploracao: "missionExploration",
  missionexploration: "missionExploration",
  exploracao: "exploration",
  exploração: "exploration",
  mission_bestiario: "missionBestiary",
  missionbestiary: "missionBestiary",
  bestiario: "bestiary",
  mission_forum: "missionForum",
  missionforum: "missionForum",
  comunidade: "community",
  mission_hunts: "missionHunts",
  missionhunts: "missionHunts",
  hunt: "hunt",
  hunts: "hunt",
  divulgacao: "promotion",
  divulgação: "promotion",
  conhecimento: "knowledge",
  recrutamento: "recruitment",
  musica: "music",
  música: "music",
  "1goldcoin": "gold1",
  "5goldcoin": "gold5",
  "1diamond": "diamond1",
  "3diamonds": "diamond3",
  "125tc": "tc125",
  "250tc": "tc250",
  "500rc": "rc500",
  "1000rc": "rc1000",
  ferumbrashat: "ferumbrasHat",
  ferumbras_hat: "ferumbrasHat",
};

function canonicalImageKey(imageKey) {
  if (!imageKey) return null;
  if (REWARDS_ASSETS[imageKey]) return imageKey;
  const normalized = String(imageKey)
    .trim()
    .toLowerCase()
    .replace(/\.(png|webp|jpe?g|gif)$/i, "")
    .replace(/[\s-]+/g, "_");
  return IMAGE_ALIASES[normalized] || IMAGE_ALIASES[normalized.replace(/_/g, "")] || null;
}

function resolveAsset(imageKey) {
  const key = canonicalImageKey(imageKey);
  return key ? REWARDS_ASSETS[key] : null;
}

function missionImageKey(mission) {
  return canonicalImageKey(mission?.imageKey) || MISSION_CARD_BY_CATEGORY[mission?.category] || null;
}

function translated(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

function categoryLabel(category, t) {
  if (!category) return "";
  return translated(t, `rewardsScreen.categories.${category}`, category);
}

function statusText(status, t) {
  if (!status) return "";
  return translated(t, `rewardsScreen.status.${status}`, status);
}

function mapRewardsError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 401) return t("auth.sessionExpired");
  if (error?.status === 403) return t("rewardsScreen.premiumRequired");
  const mapped = REWARD_ERROR_KEYS[error?.message];
  if (mapped) return t(mapped);
  if (error?.status === 503) return t("rewardsScreen.unavailableNow");
  return t("auth.genericError");
}

function catalogTypeLabel(item, t) {
  if (item.premium || item.currency === "DIAMOND") return t("rewardsScreen.diamondPremium");
  if (item.imageKey === "rc1000") return t("rewardsScreen.rubiniPremium");
  if (item.imageKey === "rc500") return t("rewardsScreen.rubini");
  if (item.imageKey === "tc125" || item.imageKey === "tc250") return t("rewardsScreen.tibiaGlobal");
  if (item.currency === "GOLD") return t("rewardsScreen.goldReward");
  return t("rewardsScreen.rewardFallback");
}

function catalogPriceLabel(item, t, locale) {
  if (!item?.priceConfigured || !item.price) {
    return item?.currency === "DIAMOND"
      ? t("rewardsScreen.priceMissingDiamond")
      : t("rewardsScreen.priceMissingGold");
  }
  const amount = formatPoints(item.price, locale);
  return item.currency === "DIAMOND"
    ? t("rewardsScreen.diamondPrice", { amount })
    : t("rewardsScreen.goldPrice", { amount });
}

function packageCopy(item, t) {
  const copy = PACKAGE_COPY[item.id] || {};
  return {
    kicker: copy.kicker ? t(copy.kicker) : item.kicker,
    title: copy.title ? t(copy.title) : item.title,
    hint: copy.hint ? t(copy.hint) : item.hint,
  };
}

function packagePrice(item, t, locale) {
  if (item.goldCost != null) {
    return t("rewardsScreen.goldPrice", { amount: formatPoints(item.goldCost, locale) });
  }
  if (item.pointsCost != null) {
    return t("rewardsScreen.pointsPrice", { amount: formatPoints(item.pointsCost, locale) });
  }
  return "—";
}

function isDiamondPack(item) {
  return item?.id === "diamond1" || item?.id === "diamond3";
}

function currencyUnit(amount, kind, t, locale) {
  const value = formatPoints(amount, locale);
  if (kind === "diamond") {
    return Number(amount) === 1
      ? t("rewardsScreen.oneDiamond")
      : t("rewardsScreen.manyDiamond", { amount: value });
  }
  return Number(amount) === 1
    ? t("rewardsScreen.oneGold")
    : t("rewardsScreen.manyGold", { amount: value });
}

function mapMission(row) {
  return {
    ...row,
    name: row?.title || row?.name || "",
    description: row?.description || "",
    current: finiteCount(row?.current),
    target: finiteCount(row?.target),
    rewardPoints: finiteCount(row?.rewardPoints),
    completed: Boolean(row?.completed),
  };
}

function walletFrom(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.wallet && typeof payload.wallet === "object") return payload.wallet;
  if ("points" in payload || "gold" in payload || "diamond" in payload) return payload;
  return null;
}

function formatWhen(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString(locale);
  } catch {
    return "";
  }
}

function missionActionLabel(mission, t) {
  if (mission.completed) return t("rewardsScreen.completed");
  if (mission.current > 0) return t("rewardsScreen.continue");
  return t("rewardsScreen.start");
}

function BalancePill({ label, value, tone }) {
  return (
    <View style={[styles.balancePill, tone === "diamond" && styles.balancePillDiamond, tone === "gold" && styles.balancePillGold]}>
      <Text style={styles.balancePillText} numberOfLines={1}>
        {label}:{" "}
        <Text style={[styles.balanceValue, tone === "diamond" && styles.balanceValueDiamond, tone === "gold" && styles.balanceValue]}>
          {value}
        </Text>
      </Text>
    </View>
  );
}

function SectionHead({ title, accent, hint, meta, wide }) {
  return (
    <View style={[styles.sectionHead, wide && styles.sectionHeadRow]}>
      <View style={styles.sectionHeadCopy}>
        <Text style={styles.sectionTitle}>
          {title}
          {accent ? <Text style={styles.sectionTitleGold}> {accent}</Text> : null}
        </Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

function MissionCard({ mission, onPress, t, locale, compact }) {
  const source = resolveAsset(missionImageKey(mission));
  const pct = missionProgressPercent(mission.current, mission.target);

  return (
    <Pressable onPress={() => onPress(mission)} style={({ pressed }) => [styles.missionCard, pressed && styles.pressed]}>
      {source ? <Image source={source} style={styles.missionImage} resizeMode="cover" /> : <View style={styles.missionImage} />}
      <LinearGradient
        colors={["transparent", "rgba(2,7,14,0.05)", "rgba(2,7,14,0.94)"]}
        locations={[0, 0.38, 1]}
        style={styles.missionOverlay}
      />
      <View style={styles.missionBody}>
        <View style={styles.missionTop}>
          <Text style={styles.missionCategory} numberOfLines={1}>
            {categoryLabel(mission.category, t)}
          </Text>
          <Text style={styles.missionReward} numberOfLines={1}>
            +{formatPoints(mission.rewardPoints, locale)} {t("rewardsScreen.pts")}
          </Text>
        </View>
        <Text style={styles.missionTitle} numberOfLines={compact ? 1 : 2}>
          {mission.name}
        </Text>
        <Text style={styles.missionDesc} numberOfLines={compact ? 1 : 2}>
          {mission.description}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressCount}>
            {mission.current} / {mission.target}
          </Text>
        </View>
        <View style={styles.missionAction}>
          <Text style={styles.missionActionHint}>{t("rewardsScreen.progress")}</Text>
          <Text style={styles.missionActionState}>{missionActionLabel(mission, t)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ConversionCard({ item, diamond, onPress, busy, t, locale }) {
  const source = resolveAsset(item.imageKey);
  const copy = packageCopy(item, t);
  const unavailable = diamond && !item.enabled;
  const disabled = unavailable || busy || item.enabled === false;
  const price = packagePrice(item, t, locale);

  return (
    <View style={[styles.conversionCard, diamond && styles.conversionCardDiamond]}>
      <View style={styles.conversionArt}>
        {source ? <Image source={source} style={styles.conversionImage} resizeMode="cover" /> : null}
      </View>
      <View style={styles.conversionCopy}>
        <Text style={styles.conversionKicker} numberOfLines={1}>
          {copy.kicker}
        </Text>
        <Text style={styles.conversionTitle} numberOfLines={2}>
          {copy.title}
        </Text>
        {unavailable ? (
          <Text style={styles.conversionSoon}>{t("rewardsScreen.comingSoon")}</Text>
        ) : (
          <Text style={[styles.conversionPrice, diamond && styles.conversionPriceDiamond]}>{price}</Text>
        )}
        {unavailable ? (
          <Text style={styles.conversionHint}>{t("rewardsScreen.diamondRateMissing")}</Text>
        ) : item.savings > 0 ? (
          <Text style={styles.conversionBonus}>
            {t("rewardsScreen.savePoints", { amount: formatPoints(item.savings, locale) })}
          </Text>
        ) : copy.hint ? (
          <Text style={styles.conversionHint}>{copy.hint}</Text>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.conversionBtn,
            diamond && styles.conversionBtnDiamond,
            disabled && styles.conversionBtnDisabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.conversionBtnText, diamond && styles.conversionBtnTextDiamond]}>
            {unavailable ? t("rewardsScreen.unavailable") : t("rewardsScreen.convert")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RewardCard({ item, balance, onPress, busy, t, locale }) {
  const source = resolveAsset(item.imageKey);
  const premium = item.premium || item.currency === "DIAMOND";
  const progress = affordancePercent(balance, item.price, item.priceConfigured);
  const redemptionCount = Number(item.redemptionCount);
  const hasRedemptionCount = Number.isFinite(redemptionCount) && redemptionCount >= 0 && item.redemptionCount != null;
  const disabled = busy || !item.priceConfigured;

  return (
    <View style={[styles.storeItem, premium && styles.storeItemDiamond]}>
      <View style={styles.itemArt}>
        {source ? <Image source={source} style={styles.itemArtImage} resizeMode="cover" /> : null}
      </View>
      <View style={styles.storeInfo}>
        <Text style={[styles.storeType, premium && styles.storeTypeDiamond]} numberOfLines={1}>
          {catalogTypeLabel(item, t)}
        </Text>
        <Text style={styles.storeName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.storeDesc} numberOfLines={3}>
          {item.description}
        </Text>
        <Text style={[styles.storeCost, premium && styles.storeCostDiamond]}>{catalogPriceLabel(item, t, locale)}</Text>
        <View style={styles.storeMeta}>
          <Text style={styles.storeMetaText}>{t("rewardsScreen.progress")}</Text>
          <Text style={styles.storeMetaText}>{progress == null ? "—" : `${progress}%`}</Text>
        </View>
        <View style={[styles.storeProgress, premium && styles.storeProgressDiamond]}>
          <View
            style={[
              styles.storeProgressFill,
              premium && styles.storeProgressFillDiamond,
              { width: `${progress ?? 0}%` },
            ]}
          />
        </View>
        {hasRedemptionCount ? (
          <View style={styles.storeMetaPlain}>
            <Text style={styles.storeMetaText}>{t("rewardsScreen.redemptions")}</Text>
            <Text style={styles.storeMetaText}>{t("rewardsScreen.players", { count: formatPoints(redemptionCount, locale) })}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [styles.storeBtn, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
        >
          <LinearGradient
            colors={premium ? ["#b8eaff", "#3aaeff"] : ["#f0cd68", "#b78524"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.storeBtnText, premium && styles.storeBtnTextDiamond]}>
            {t("rewardsScreen.redeem")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Grid({ rows, columns, rowKey, renderItem }) {
  return rows.map((row, index) => (
    <View key={`${rowKey}-${index}`} style={styles.gridRow}>
      {row.map((item) => (
        <View key={item.id} style={styles.gridCol}>
          {renderItem(item)}
        </View>
      ))}
      {Array.from({ length: columns - row.length }).map((_, filler) => (
        <View key={`${rowKey}-filler-${index}-${filler}`} style={styles.gridCol} />
      ))}
    </View>
  ));
}

export default function ShopScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { token, activeCharacter } = useAuth();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState("DAILY");
  const [dataPeriod, setDataPeriod] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [wallet, setWallet] = useState({ points: 0, gold: 0, diamond: 0 });
  const [missions, setMissions] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [goldPackages, setGoldPackages] = useState(() => mapGoldPackages(null));
  const [diamondOffers, setDiamondOffers] = useState(() => mapDiamondOffers(null));
  const [loading, setLoading] = useState(true);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const rewardRequests = useRef(createLatestRequest()).current;
  const periodRef = useRef(period);
  const dataPeriodRef = useRef(null);
  const hasDataRef = useRef(false);
  const tokenRef = useRef(token);
  const actionGate = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tokenRef.current === token) return;
    tokenRef.current = token;
    hasDataRef.current = false;
    dataPeriodRef.current = null;
    setHasData(false);
    setDataPeriod(null);
    setWallet({ points: 0, gold: 0, diamond: 0 });
    setMissions([]);
    setCatalog([]);
    setRedemptions([]);
    setSelectedMission(null);
  }, [token]);

  const applyWallet = useCallback((next) => {
    if (!next) return;
    setWallet({
      points: Number(next.points || 0),
      gold: Number(next.gold || 0),
      diamond: Number(next.diamond || 0),
    });
  }, []);

  const loadAll = useCallback(
    async (nextPeriod = periodRef.current, mode = "initial") => {
      const current = rewardRequests.start();
      if (!token) {
        if (!current()) return;
        setError(t("auth.sessionExpired"));
        setLoading(false);
        setMissionsLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === "refresh") setRefreshing(true);
      else if (mode === "period") setMissionsLoading(true);
      else if (mode === "initial") setLoading(true);
      if (mode !== "silent" && mode !== "refresh") setError("");

      try {
        const [me, missionList, catalogList, history] = await Promise.all([
          getRewardsMe(token),
          listRewardMissions(token, nextPeriod),
          listRewardCatalog(token),
          listRewardRedemptions(token),
        ]);
        if (!current() || periodRef.current !== nextPeriod) return;
        applyWallet(me?.wallet);
        setGoldPackages(mapGoldPackages(me?.conversions?.pointsToGold));
        setDiamondOffers(mapDiamondOffers(me?.conversions?.goldToDiamond));
        setCatalog(Array.isArray(catalogList) ? catalogList : []);
        setRedemptions(Array.isArray(history) ? history : []);
        setMissions(Array.isArray(missionList) ? missionList.map(mapMission) : []);
        dataPeriodRef.current = nextPeriod;
        hasDataRef.current = true;
        setDataPeriod(nextPeriod);
        setHasData(true);
        setError("");
      } catch (err) {
        if (!current()) return;
        setError(mapRewardsError(err, t));
      } finally {
        if (!current()) return;
        setLoading(false);
        setMissionsLoading(false);
        setRefreshing(false);
      }
    },
    [applyWallet, rewardRequests, t, token],
  );

  const refreshAfterAction = useCallback(
    async (knownWallet) => {
      const current = rewardRequests.start();
      if (knownWallet) applyWallet(knownWallet);
      const requested = periodRef.current;
      if (!token) return;
      try {
        const [me, missionList, catalogList, history] = await Promise.all([
          getRewardsMe(token),
          listRewardMissions(token, requested),
          listRewardCatalog(token),
          listRewardRedemptions(token),
        ]);
        if (!current()) return;
        applyWallet(me?.wallet);
        setGoldPackages(mapGoldPackages(me?.conversions?.pointsToGold));
        setDiamondOffers(mapDiamondOffers(me?.conversions?.goldToDiamond));
        setCatalog(Array.isArray(catalogList) ? catalogList : []);
        setRedemptions(Array.isArray(history) ? history : []);
        if (periodRef.current !== requested) {
          await loadAll(periodRef.current, "period");
          return;
        }
        setMissions(Array.isArray(missionList) ? missionList.map(mapMission) : []);
        dataPeriodRef.current = requested;
        hasDataRef.current = true;
        setDataPeriod(requested);
        setHasData(true);
        setError("");
      } catch (err) {
        if (!current()) return;
        setError(knownWallet ? t("rewardsScreen.refreshFailed") : mapRewardsError(err, t));
      } finally {
        if (current()) {
          setLoading(false);
          setMissionsLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyWallet, loadAll, rewardRequests, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      periodRef.current = period;
      const mode = !hasDataRef.current ? "initial" : period !== dataPeriodRef.current ? "period" : "silent";
      loadAll(period, mode);
      return () => {
        rewardRequests.cancel();
      };
    }, [loadAll, period, rewardRequests]),
  );

  const wide = width >= 620;
  const missionColumns = width >= 900 ? 3 : 2;
  const storeColumns = width >= 900 ? 4 : 2;
  const conversionColumns = wide ? 2 : 1;
  const compactMissions = missionColumns > 1 && width < 780;
  const loadedPeriodMissions = useMemo(
    () => (dataPeriod === period ? missions : []),
    [dataPeriod, missions, period],
  );
  const visibleMissions = useMemo(
    () => loadedPeriodMissions.filter(isPlayableRewardMission),
    [loadedPeriodMissions],
  );
  const missionRows = useMemo(() => chunkRows(visibleMissions, missionColumns), [missionColumns, visibleMissions]);
  const catalogRows = useMemo(() => chunkRows(catalog, storeColumns), [catalog, storeColumns]);
  const goldRows = useMemo(() => chunkRows(goldPackages, conversionColumns), [conversionColumns, goldPackages]);
  const diamondRows = useMemo(() => chunkRows(diamondOffers, conversionColumns), [conversionColumns, diamondOffers]);
  const periodMeta = PERIOD_TABS.find((tab) => tab.id === period);
  const renewalSource = loadedPeriodMissions[0]?.periodEnd || periodWindow(period, now)?.periodEnd;
  const renewalLabel = hasData ? formatRenewal(renewalSource, now) || "—" : "—";
  const playerName = activeCharacter?.name || t("rewardsScreen.progressTitle");
  const diamondConfigured = diamondOffers.some((offer) => offer.enabled);
  const completedCount = visibleMissions.filter((mission) => mission.completed).length;
  const totalCount = visibleMissions.length;
  const periodPending = hasData && dataPeriod !== period;
  const actionsLocked = busy || promptOpen;
  const openMission =
    selectedMission && dataPeriod === period
      ? visibleMissions.find((mission) => mission.id === selectedMission.id) || null
      : null;
  const activityPath = openMission ? missionActivityPath(openMission.eventType) : null;

  function changePeriod(next) {
    if (next === periodRef.current) return;
    periodRef.current = next;
    setPeriod(next);
    setSelectedMission(null);
  }

  function releasePrompt() {
    if (actionGate.current === "running") return;
    actionGate.current = false;
    setPromptOpen(false);
  }

  function confirmConvert(pack) {
    if (actionGate.current || actionsLocked || pack.enabled === false) return;
    const diamond = isDiamondPack(pack);
    actionGate.current = true;
    setPromptOpen(true);
    const price = packagePrice(pack, t, locale);
    Alert.alert(
      t("rewardsScreen.convertTitle"),
      diamond
        ? t("rewardsScreen.convertDiamondBody", { price, amount: pack.amount })
        : t("rewardsScreen.convertGoldBody", { price, amount: pack.amount }),
      [
        { text: t("common.cancel"), style: "cancel", onPress: releasePrompt },
        {
          text: t("rewardsScreen.convert"),
          onPress: () => {
            actionGate.current = "running";
            setBusy(true);
            void runConvert(pack, diamond);
          },
        },
      ],
      { cancelable: true, onDismiss: releasePrompt },
    );
  }

  async function runConvert(pack, diamond) {
    try {
      if (!token) {
        setError(t("auth.sessionExpired"));
        return;
      }
      const nextWallet = await convertRewards(token, diamond ? "GOLD_TO_DIAMOND" : "POINTS_TO_GOLD", pack.amount);
      const shown = walletFrom(nextWallet);
      await refreshAfterAction(shown);
      if (shown) {
        Alert.alert(
          t("rewardsScreen.convertTitle"),
          t("rewardsScreen.convertDone", {
            points: formatPoints(shown.points, locale),
            gold: formatPoints(shown.gold, locale),
            diamond: formatPoints(shown.diamond, locale),
          }),
        );
      }
    } catch (err) {
      Alert.alert(t("rewardsScreen.convertTitle"), mapRewardsError(err, t));
    } finally {
      actionGate.current = false;
      setPromptOpen(false);
      setBusy(false);
    }
  }

  function confirmRedeem(item) {
    if (actionGate.current || actionsLocked || !item?.priceConfigured || !item?.id) return;
    actionGate.current = true;
    setPromptOpen(true);
    Alert.alert(
      t("rewardsScreen.redeemTitle"),
      t("rewardsScreen.redeemBody", { name: item.name, price: catalogPriceLabel(item, t, locale) }),
      [
        { text: t("common.cancel"), style: "cancel", onPress: releasePrompt },
        {
          text: t("rewardsScreen.redeem"),
          onPress: () => {
            actionGate.current = "running";
            setBusy(true);
            void runRedeem(item);
          },
        },
      ],
      { cancelable: true, onDismiss: releasePrompt },
    );
  }

  async function runRedeem(item) {
    try {
      if (!token) {
        setError(t("auth.sessionExpired"));
        return;
      }
      const result = await redeemReward(token, item.id);
      await refreshAfterAction(walletFrom(result));
      const status = result?.redemption?.status;
      Alert.alert(
        t("rewardsScreen.redeemTitle"),
        status ? statusText(status, t) : t("rewardsScreen.redeemDone"),
      );
    } catch (err) {
      Alert.alert(t("rewardsScreen.redeemTitle"), mapRewardsError(err, t));
    } finally {
      actionGate.current = false;
      setPromptOpen(false);
      setBusy(false);
    }
  }

  const pointsLabel = hasData ? formatPoints(wallet.points, locale) : "—";
  const showMissionEmpty = hasData && !periodPending && !loading && visibleMissions.length === 0 && !error;
  const showCatalogEmpty = hasData && !loading && catalog.length === 0 && !error;

  return (
    <AppScreen>
      <ImageBackground source={REWARDS_ASSETS.background} resizeMode="cover" style={styles.bg}>
        <LinearGradient colors={["rgba(2,7,15,0.22)", "rgba(2,7,15,0.38)", "rgba(2,7,15,0.82)"]} style={StyleSheet.absoluteFill} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAll(periodRef.current, hasDataRef.current ? "refresh" : "initial")}
              tintColor={GOLD2}
              colors={[GOLD2]}
            />
          }
        >
          <View style={styles.topbar}>
            <View style={styles.brand}>
              <Image source={REWARDS_ASSETS.hero} style={[styles.brandMark, wide && styles.brandMarkWide]} resizeMode="cover" />
              <View style={styles.brandCopy}>
                <Text style={[styles.brandTitle, wide && styles.brandTitleWide]} numberOfLines={1}>
                  RuneCodex
                </Text>
                <Text style={styles.brandSub} numberOfLines={1}>
                  {t("rewardsScreen.brandSub")}
                </Text>
              </View>
            </View>
            <View style={styles.points}>
              <LinearGradient colors={["#fff3ad", "#e9c45b", "#a7771d"]} style={styles.coin}>
                <Text style={styles.coinText}>R</Text>
              </LinearGradient>
              <View style={styles.pointsCopy}>
                <Text style={styles.pointsLabel} numberOfLines={1}>
                  {t("rewardsScreen.yourPoints")}
                </Text>
                <Text style={styles.pointsValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {pointsLabel}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.hero, wide && styles.heroWide]}>
            <Image source={REWARDS_ASSETS.hero} style={styles.heroImage} resizeMode="contain" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.02)", "rgba(0,0,0,0.78)"]}
              locations={[0, 0.5, 1]}
              style={styles.heroOverlay}
            />
            <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
              <Text style={styles.heroKicker}>{t("rewardsScreen.heroKicker")}</Text>
              <Text style={[styles.heroTitle, wide && styles.heroTitleWide]}>{t("rewardsScreen.heroTitle")}</Text>
              <Text style={styles.heroSub}>{t("rewardsScreen.heroSub")}</Text>
            </View>
          </View>

          {error ? (
            <Pressable onPress={() => loadAll(periodRef.current, hasData ? "silent" : "initial")} style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
              <Text style={styles.bannerAction}>{t("rewardsScreen.retry")}</Text>
            </Pressable>
          ) : null}

          {!hasData && loading ? <ActivityIndicator color={GOLD2} style={styles.loader} /> : null}

          <View style={[styles.summary, !wide && styles.summaryCompact]}>
            <View style={styles.player}>
              <View style={styles.avatar}>
                <Text style={styles.avatarMark}>⚔</Text>
              </View>
              <View style={styles.playerCopy}>
                <Text style={styles.playerKicker}>{t("rewardsScreen.adventurer")}</Text>
                <Text style={styles.playerName} numberOfLines={2}>
                  {playerName}
                </Text>
              </View>
            </View>
            <View style={[styles.reset, !wide && styles.resetCompact]}>
              <Text style={styles.resetLabel}>{t("rewardsScreen.nextRenewal")}</Text>
              <Text style={styles.resetValue}>{renewalLabel}</Text>
            </View>
          </View>

          {hasData ? (
            <>
              <View style={styles.section}>
                <SectionHead
                  wide={wide}
                  title={t("rewardsScreen.missions")}
                  accent={periodMeta ? t(periodMeta.labelKey) : ""}
                  hint={t("rewardsScreen.missionsHint")}
                  meta={periodPending ? "—" : t("rewardsScreen.completedCount", { done: completedCount, total: totalCount })}
                />

                <View style={styles.tabs}>
                  {PERIOD_TABS.map((tab) => {
                    const active = tab.id === period;
                    const count = active && !periodPending ? totalCount : null;
                    return (
                      <Pressable
                        key={tab.id}
                        onPress={() => changePeriod(tab.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[styles.tab, active && styles.tabActive]}
                      >
                        {active ? (
                          <LinearGradient
                            colors={["#f4d879", "#b78220"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                        ) : null}
                        <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={2}>
                          {t(tab.labelKey).toUpperCase()}
                          {count != null ? <Text style={styles.tabCount}> {count}</Text> : null}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {periodPending || missionsLoading ? <ActivityIndicator color={GOLD2} style={styles.loader} /> : null}

                <Grid
                  rows={missionRows}
                  columns={missionColumns}
                  rowKey="mission"
                  renderItem={(mission) => (
                    <MissionCard
                      mission={mission}
                      compact={compactMissions}
                      t={t}
                      locale={locale}
                      onPress={setSelectedMission}
                    />
                  )}
                />
                {showMissionEmpty ? <Text style={styles.note}>{t("rewardsScreen.emptyMissions")}</Text> : null}
                <Text style={styles.note}>{t("rewardsScreen.missionsNote")}</Text>
              </View>

              <View style={styles.section}>
                <SectionHead
                  wide={wide}
                  title={t("rewardsScreen.economy")}
                  accent={t("rewardsScreen.economyBrand")}
                  hint={t("rewardsScreen.economyHint")}
                  meta={t("rewardsScreen.currencies")}
                />

                <View style={styles.economy}>
                  <View style={styles.economyIntro}>
                    <Text style={styles.economyTitle}>{t("rewardsScreen.economyFlow")}</Text>
                    <Text style={styles.economySub}>{t("rewardsScreen.economyBody")}</Text>
                    <View style={styles.balanceRow}>
                      <BalancePill label={t("rewardsScreen.points")} value={formatPoints(wallet.points, locale)} />
                      <BalancePill label={t("rewardsScreen.gold")} value={formatPoints(wallet.gold, locale)} tone="gold" />
                      <BalancePill label={t("rewardsScreen.diamond")} value={formatPoints(wallet.diamond, locale)} tone="diamond" />
                    </View>
                  </View>

                  <View style={styles.economyGroup}>
                    <View style={styles.groupTitleRow}>
                      <Text style={styles.groupTitle}>{t("rewardsScreen.toGold")}</Text>
                      <View style={styles.groupLine} />
                    </View>
                    <Grid
                      rows={goldRows}
                      columns={conversionColumns}
                      rowKey="gold"
                      renderItem={(item) => (
                        <ConversionCard
                          item={item}
                          busy={actionsLocked}
                          t={t}
                          locale={locale}
                          onPress={() => confirmConvert(item)}
                        />
                      )}
                    />
                  </View>

                  <View style={styles.economyGroup}>
                    <View style={styles.groupTitleRow}>
                      <Text style={styles.groupTitle}>{t("rewardsScreen.toDiamond")}</Text>
                      <View style={styles.groupLine} />
                    </View>
                    <Grid
                      rows={diamondRows}
                      columns={conversionColumns}
                      rowKey="diamond"
                      renderItem={(item) => (
                        <ConversionCard
                          item={item}
                          diamond
                          busy={actionsLocked}
                          t={t}
                          locale={locale}
                          onPress={() => confirmConvert(item)}
                        />
                      )}
                    />
                  </View>

                  <View style={styles.economyRule}>
                    <Text style={styles.economyRuleText}>
                      <Text style={styles.ruleStrong}>{t("rewardsScreen.pathIntro")}</Text>
                      {goldPackages
                        .filter((pack) => pack.enabled !== false)
                        .map((pack, index) => (
                          <Text key={pack.id}>
                            {index > 0 ? " · " : ""}
                            <Text style={styles.ruleGold}>
                              {packagePrice(pack, t, locale)} → {currencyUnit(pack.amount, "gold", t, locale)}
                            </Text>
                          </Text>
                        ))}
                      {" · "}
                      {diamondConfigured ? (
                        diamondOffers
                          .filter((offer) => offer.enabled)
                          .map((offer, index) => (
                            <Text key={offer.id}>
                              {index > 0 ? " · " : ""}
                              <Text style={styles.ruleBlue}>
                                {packagePrice(offer, t, locale)} → {currencyUnit(offer.amount, "diamond", t, locale)}
                              </Text>
                            </Text>
                          ))
                      ) : (
                        <Text style={styles.ruleBlue}>{t("rewardsScreen.diamondUnconfigured")}</Text>
                      )}
                      .
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <SectionHead
                  wide={wide}
                  title={t("rewardsScreen.store")}
                  accent={t("rewardsScreen.storeAccent")}
                  hint={t("rewardsScreen.storeHint")}
                  meta={
                    catalog.length === 1
                      ? t("rewardsScreen.itemCountOne", { count: catalog.length })
                      : t("rewardsScreen.itemCount", { count: catalog.length })
                  }
                />

                <Grid
                  rows={catalogRows}
                  columns={storeColumns}
                  rowKey="store"
                  renderItem={(item) => (
                    <RewardCard
                      item={item}
                      balance={item.currency === "DIAMOND" ? wallet.diamond : wallet.gold}
                      busy={actionsLocked}
                      t={t}
                      locale={locale}
                      onPress={() => confirmRedeem(item)}
                    />
                  )}
                />
                {showCatalogEmpty ? <Text style={styles.note}>{t("rewardsScreen.emptyCatalog")}</Text> : null}
                {catalog.length > 0 ? <Text style={styles.note}>{t("rewardsScreen.catalogNote")}</Text> : null}
              </View>

              <View style={styles.section}>
                <SectionHead
                  wide={wide}
                  title={t("rewardsScreen.history")}
                  accent={t("rewardsScreen.historyAccent")}
                  hint={t("rewardsScreen.historyHint")}
                />
                <View style={styles.historyPanel}>
                  {redemptions.length === 0 ? (
                    <Text style={styles.historyMessage}>{t("rewardsScreen.emptyHistory")}</Text>
                  ) : (
                    redemptions.map((item, index) => (
                      <View key={item.id} style={[styles.historyRow, index > 0 && styles.historyDivider]}>
                        <Text style={styles.historyName}>{item.name || item.reward?.name}</Text>
                        <Text style={styles.historyMeta}>
                          {formatPoints(item.price ?? item.cost, locale)}{" "}
                          {item.currency === "DIAMOND" ? t("rewardsScreen.diamond") : t("rewardsScreen.gold")}
                          {item.createdAt ? ` · ${formatWhen(item.createdAt, locale)}` : ""}
                        </Text>
                        <Text style={styles.historyMessage}>{item.message && locale === "pt-BR" ? item.message : statusText(item.status, t)}</Text>
                        {item.adminNote ? <Text style={styles.historyNote}>{item.adminNote}</Text> : null}
                      </View>
                    ))
                  )}
                </View>
              </View>

              <Text style={styles.footer}>{t("rewardsScreen.footer")}</Text>
            </>
          ) : null}
        </ScrollView>
      </ImageBackground>

      <Modal visible={Boolean(openMission)} transparent animationType="fade" onRequestClose={() => setSelectedMission(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMission(null)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {openMission ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>{openMission.name}</Text>
                  <Pressable onPress={() => setSelectedMission(null)} hitSlop={12} accessibilityRole="button">
                    <Text style={styles.modalClose}>×</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalText}>
                  {periodMeta ? t(periodMeta.oneKey) : categoryLabel(openMission.category, t)} · {openMission.description}
                </Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${missionProgressPercent(openMission.current, openMission.target)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressCount}>
                    {openMission.current} / {openMission.target}
                  </Text>
                </View>
                <Text style={styles.modalReward}>
                  {t("rewardsScreen.missionReward", { amount: formatPoints(openMission.rewardPoints, locale) })}
                </Text>
                <Text style={[styles.modalText, openMission.completed && styles.modalDone]}>
                  {openMission.completed
                    ? t("rewardsScreen.completed")
                    : activityPath
                      ? t("rewardsScreen.missionAuto")
                      : t("rewardsScreen.missionUnavailable")}
                </Text>
                {activityPath ? (
                  <Pressable
                    style={styles.storeBtn}
                    onPress={() => {
                      setSelectedMission(null);
                      router.push(activityPath);
                    }}
                  >
                    <LinearGradient colors={["#f0cd68", "#b78524"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <Text style={styles.storeBtnText}>
                      {activityPath === "/(tabs)/forum" ? t("rewardsScreen.goForum") : t("rewardsScreen.openActivity")}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scroll: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 36 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
  loader: { marginTop: 18 },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    gap: 8,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
  },
  brandMarkWide: { width: 52, height: 52 },
  brandCopy: { flex: 1, minWidth: 0 },
  brandTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", letterSpacing: 0.4 },
  brandTitleWide: { fontSize: 25 },
  brandSub: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  points: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    maxWidth: "46%",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
    backgroundColor: "rgba(4,12,25,0.76)",
  },
  pointsCopy: { flexShrink: 1, minWidth: 0 },
  coin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#f5db82",
  },
  coinText: { color: "#2b210c", fontSize: 16, fontWeight: "800" },
  pointsLabel: {
    color: Colors.muted,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pointsValue: { color: GOLD2, fontSize: 16, fontWeight: "700", marginTop: 1 },

  hero: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.48)",
    backgroundColor: "#050b15",
  },
  heroWide: { borderRadius: 22 },
  heroImage: { width: "100%", height: "100%", backgroundColor: "#050b15" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 16 },
  heroCopyWide: { left: 28, bottom: 24 },
  heroKicker: {
    color: GOLD2,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: "800", letterSpacing: 0.4 },
  heroTitleWide: { fontSize: 40 },
  heroSub: { color: "#d6dfeb", marginTop: 4, fontSize: 12 },

  summary: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
    backgroundColor: "rgba(5,15,29,0.72)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryCompact: { flexDirection: "column", alignItems: "flex-start" },
  player: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17345b",
    borderWidth: 1,
    borderColor: GOLD,
  },
  avatarMark: { color: GOLD2, fontSize: 18 },
  playerCopy: { flex: 1, minWidth: 0 },
  playerKicker: { color: Colors.muted, fontSize: 10 },
  playerName: { color: GOLD2, fontSize: 15, fontWeight: "700", marginTop: 1 },
  reset: { alignItems: "flex-end" },
  resetCompact: { alignItems: "flex-start" },
  resetLabel: { color: Colors.muted, fontSize: 10, textTransform: "uppercase" },
  resetValue: { color: Colors.text, fontSize: 15, fontWeight: "700", marginTop: 2 },

  banner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.34)",
    backgroundColor: "rgba(4,12,24,0.88)",
    gap: 6,
  },
  bannerText: { color: Colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  bannerAction: { color: GOLD2, fontSize: 12, fontWeight: "800" },

  section: { marginTop: 18 },
  sectionHead: { marginBottom: 8, gap: 4 },
  sectionHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  sectionHeadCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  sectionTitleGold: { color: GOLD2 },
  sectionHint: { color: Colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  sectionMeta: { color: Colors.muted, fontSize: 12 },

  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.25)",
    backgroundColor: "rgba(3,10,20,0.74)",
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tabActive: { borderWidth: 1, borderColor: "#f0ce6b" },
  tabText: {
    color: "#8796aa",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  tabTextActive: { color: "#1a1307" },
  tabCount: { opacity: 0.75 },

  gridRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  gridCol: { flex: 1, minWidth: 0 },

  missionCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.55)",
    backgroundColor: "#07111d",
  },
  missionImage: { width: "100%", aspectRatio: 300 / 332, backgroundColor: "#050b15" },
  missionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "46%",
  },
  missionBody: { position: "absolute", left: 8, right: 8, bottom: 8 },
  missionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  missionCategory: { color: "#f7f8fb", fontSize: 9, fontWeight: "800", flex: 1, letterSpacing: 0.4 },
  missionReward: { color: GOLD2, fontWeight: "800", fontSize: 10 },
  missionTitle: { color: Colors.text, fontWeight: "700", fontSize: 12, marginTop: 2 },
  missionDesc: { color: "#d5deea", fontSize: 9, marginTop: 2, lineHeight: 12 },
  progressRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "#09182a",
    borderWidth: 1,
    borderColor: "#27405c",
  },
  progressFill: { height: "100%", borderRadius: 99, backgroundColor: BLUE },
  progressCount: { color: "#d0d9e5", fontSize: 10, fontWeight: "700" },
  missionAction: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  missionActionHint: { color: "#8d9cb0", fontSize: 10 },
  missionActionState: { color: BLUE2, fontWeight: "800", fontSize: 10 },
  note: { color: "#7e8da2", fontSize: 11, marginTop: 4, lineHeight: 16 },

  economy: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.34)",
    backgroundColor: "rgba(4,12,23,0.78)",
  },
  economyIntro: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  economyTitle: { color: GOLD2, fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
  economySub: { color: Colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4, marginBottom: 10 },
  balanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  balancePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  balancePillGold: { borderColor: "rgba(217,173,63,0.4)" },
  balancePillDiamond: { borderColor: "rgba(78,178,255,0.4)" },
  balancePillText: { color: "#b8c6d6", fontSize: 11, fontWeight: "700" },
  balanceValue: { color: GOLD2, fontWeight: "800" },
  balanceValueDiamond: { color: BLUE2 },
  economyGroup: { paddingHorizontal: 12, paddingTop: 14 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  groupTitle: { color: "#f0d273", fontSize: 15, fontWeight: "800" },
  groupLine: { flex: 1, height: 1, backgroundColor: "rgba(217,173,63,0.32)" },

  conversionCard: {
    width: "100%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.24)",
    backgroundColor: "rgba(9,21,37,0.92)",
  },
  conversionCardDiamond: { borderColor: "rgba(78,178,255,0.28)" },
  conversionArt: {
    width: 104,
    height: 104,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#02050a",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
  },
  conversionImage: { width: "100%", height: "100%" },
  conversionCopy: { flex: 1, minWidth: 0 },
  conversionKicker: {
    color: "#8494a8",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  conversionTitle: { color: Colors.text, fontSize: 14, fontWeight: "800", marginTop: 3 },
  conversionPrice: { color: GOLD2, fontSize: 13, fontWeight: "800", marginTop: 6 },
  conversionPriceDiamond: { color: BLUE2 },
  conversionSoon: { color: BLUE2, fontSize: 12, fontWeight: "800", marginTop: 6 },
  conversionBonus: { color: BLUE2, fontSize: 11, fontWeight: "800", marginTop: 4, lineHeight: 15 },
  conversionHint: { color: "#8e9db0", fontSize: 11, lineHeight: 15, marginTop: 4 },
  conversionBtn: {
    marginTop: 8,
    minHeight: 32,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.48)",
    backgroundColor: "rgba(217,173,63,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  conversionBtnDiamond: {
    borderColor: "rgba(78,178,255,0.38)",
    backgroundColor: "rgba(44,169,255,0.06)",
  },
  conversionBtnDisabled: { opacity: 0.55 },
  conversionBtnText: { color: GOLD2, fontSize: 11, fontWeight: "800" },
  conversionBtnTextDiamond: { color: BLUE2 },

  economyRule: {
    margin: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(44,169,255,0.16)",
    backgroundColor: "rgba(3,12,24,0.65)",
  },
  economyRuleText: { color: "#9eafc3", fontSize: 11, lineHeight: 16 },
  ruleStrong: { color: "#e4ebf4", fontWeight: "800" },
  ruleGold: { color: GOLD2, fontWeight: "800" },
  ruleBlue: { color: BLUE2, fontWeight: "800" },

  storeItem: {
    flexGrow: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.34)",
    backgroundColor: "rgba(8,19,35,0.82)",
  },
  storeItemDiamond: { borderColor: "rgba(78,178,255,0.52)" },
  itemArt: { width: "100%", aspectRatio: 1, backgroundColor: "#020509" },
  itemArtImage: { width: "100%", height: "100%" },
  storeInfo: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  storeType: {
    color: GOLD2,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  storeTypeDiamond: { color: BLUE2 },
  storeName: { color: Colors.text, fontSize: 14, fontWeight: "700", marginTop: 4 },
  storeDesc: { color: Colors.muted, fontSize: 11, marginTop: 4, lineHeight: 14 },
  storeCost: { color: GOLD2, fontWeight: "800", fontSize: 13, marginTop: 6 },
  storeCostDiamond: { color: BLUE2 },
  storeMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    gap: 8,
  },
  storeMetaPlain: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    gap: 8,
  },
  storeMetaText: { color: "#8291a4", fontSize: 10, flexShrink: 1 },
  storeProgress: {
    height: 5,
    marginTop: 6,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "#09182a",
    borderWidth: 1,
    borderColor: "#27405c",
  },
  storeProgressDiamond: { borderColor: "#1f5275" },
  storeProgressFill: { height: "100%", borderRadius: 99, backgroundColor: BLUE },
  storeProgressFillDiamond: { backgroundColor: BLUE2 },
  storeBtn: {
    marginTop: 10,
    minHeight: 40,
    borderRadius: 9,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  storeBtnText: { color: "#171106", fontWeight: "800", fontSize: 12 },
  storeBtnTextDiamond: { color: "#071421" },

  historyPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.22)",
    backgroundColor: "rgba(4,12,24,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  historyRow: { paddingVertical: 12, gap: 4 },
  historyDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  historyName: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  historyMeta: { color: "#8291a4", fontSize: 11 },
  historyMessage: { color: Colors.muted, fontSize: 12, lineHeight: 17 },
  historyNote: { color: "#d6dfeb", fontSize: 12, lineHeight: 17 },

  footer: { textAlign: "center", color: "#7e8ca0", fontSize: 11, marginTop: 22 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
    backgroundColor: "#0a172a",
    padding: 22,
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  modalTitle: { color: GOLD2, fontSize: 18, fontWeight: "700", flex: 1 },
  modalClose: { color: "#9aa9bc", fontSize: 22, lineHeight: 22 },
  modalText: { color: Colors.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  modalReward: { color: GOLD2, fontWeight: "700", marginTop: 12 },
  modalDone: { color: BLUE2 },
});
