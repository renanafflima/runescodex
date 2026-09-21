import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { Colors } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import {
  convertRewards,
  getRewardsMe,
  listRewardCatalog,
  listRewardMissions,
  listRewardRedemptions,
  redeemReward,
} from "@/src/api/rewards";

const GOLD = "#d9ad3f";
const GOLD2 = "#f3d77a";
const BLUE = "#2ca9ff";
const BLUE2 = "#79d0ff";

const REWARDS_ASSETS = {
  background: require("../../assets/Rewars/assets/rewards_background.webp"),
  hero: require("../../assets/Rewars/assets/rewards_hero.webp"),
  bestiary: require("../../assets/Rewars/assets/bestiario.PNG"),
  exploration: require("../../assets/Rewars/assets/exploracao.PNG"),
  community: require("../../assets/Rewars/assets/comunidade.PNG"),
  hunt: require("../../assets/Rewars/assets/hunt.PNG"),
  recruitment: require("../../assets/Rewars/assets/recrutamento.PNG"),
  promotion: require("../../assets/Rewars/assets/divulgacao.PNG"),
  knowledge: require("../../assets/Rewars/assets/conhecimento.PNG"),
  music: require("../../assets/Rewars/assets/musica.PNG"),
  missionBestiary: require("../../assets/Rewars/assets/mission_bestiario.png"),
  missionExploration: require("../../assets/Rewars/assets/mission_exploracao.png"),
  missionForum: require("../../assets/Rewars/assets/mission_forum.png"),
  missionHunts: require("../../assets/Rewars/assets/mission_hunts.png"),
  gold1: require("../../assets/Rewars/assets/1goldcoin.PNG"),
  gold5: require("../../assets/Rewars/assets/5goldcoin.PNG"),
  diamond1: require("../../assets/Rewars/assets/1Diamond.PNG"),
  diamond3: require("../../assets/Rewars/assets/3diamonds.PNG"),
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

const CATEGORY_LABEL = {
  BESTIARY: "BESTIÁRIO",
  EXPLORATION: "EXPLORAÇÃO",
  COMMUNITY: "COMUNIDADE",
  HUNT: "HUNT",
  RECRUITMENT: "RECRUTAMENTO",
  PROMOTION: "DIVULGAÇÃO",
  KNOWLEDGE: "CONHECIMENTO",
  MUSIC: "MÚSICA",
};

const PERIOD_TABS = [
  { id: "DAILY", label: "Diárias" },
  { id: "WEEKLY", label: "Semanais" },
  { id: "MONTHLY", label: "Mensais" },
];

const GOLD_CONVERSIONS = [
  {
    id: "gold1",
    imageKey: "gold1",
    amount: 1,
    kicker: "Conversão padrão",
    title: "1 GOLD COIN",
    price: "10.000 pontos",
    hint: "Troque seus pontos por 1 Gold permanente.",
    bonus: null,
  },
  {
    id: "gold5",
    imageKey: "gold5",
    amount: 5,
    kicker: "Pacote com bônus",
    title: "5 GOLD COINS",
    price: "45.000 pontos",
    hint: "Economize 5.000 pontos ao escolher o pacote.",
    bonus: "BÔNUS +5.000 PONTOS",
  },
];

const DIAMOND_CONVERSIONS = [
  {
    id: "diamond1",
    imageKey: "diamond1",
    kicker: "Moeda permanente",
    title: "1 DIAMOND",
  },
  {
    id: "diamond3",
    imageKey: "diamond3",
    kicker: "Pacote",
    title: "3 DIAMONDS",
  },
];

const REDEMPTION_STATUS_LABEL = {
  PENDING: "Resgate solicitado. Seu pedido está aguardando aprovação.",
  APPROVED: "Resgate aprovado. A entrega será realizada em breve.",
  DELIVERED: "Reward entregue.",
  CANCELLED: "Resgate cancelado.",
};

function resolveAsset(imageKey) {
  return imageKey ? REWARDS_ASSETS[imageKey] : null;
}

function missionImageKey(mission) {
  return mission.imageKey || MISSION_CARD_BY_CATEGORY[mission.category];
}

function missionActionLabel(mission) {
  if (mission.completed) return "CONCLUÍDA";
  if (mission.current > 0) return "CONTINUAR";
  return "COMEÇAR";
}

function formatPoints(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function mapRewardsError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 401) return t("auth.sessionExpired");
  if (error?.status === 400) return error.message || t("auth.invalidPayload");
  if (error?.status === 503) return error.message || "Indisponível";
  return error?.message || t("auth.genericError");
}

function catalogTypeLabel(item) {
  if (item.premium || item.currency === "DIAMOND") return "Diamond · Premium";
  if (item.imageKey === "rc500" || item.imageKey === "rc1000") return "Rubini OT";
  return "Tibia Global";
}

function catalogPriceLabel(item) {
  if (!item?.priceConfigured || !item.price) {
    return item.currency === "DIAMOND" ? "— Diamond" : "— Gold";
  }
  if (item.currency === "DIAMOND") {
    return `${formatPoints(item.price)} Diamond`;
  }
  return `${formatPoints(item.price)} Gold`;
}

function mapMission(row) {
  return {
    ...row,
    name: row.title || row.name,
    current: Number(row.current || 0),
    target: Number(row.target || 0),
    rewardPoints: Number(row.rewardPoints || 0),
    completed: Boolean(row.completed),
  };
}

function chunkPairs(list) {
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    rows.push(list.slice(i, i + 2));
  }
  return rows;
}

function BalancePill({ label, value, tone }) {
  return (
    <View style={[styles.balancePill, tone === "diamond" && styles.balancePillDiamond]}>
      <Text style={styles.balancePillText}>
        {label}:{" "}
        <Text style={[styles.balanceValue, tone === "diamond" && styles.balanceValueDiamond]}>
          {formatPoints(value)}
        </Text>
      </Text>
    </View>
  );
}

function MissionCard({ mission, onPress }) {
  const source = resolveAsset(missionImageKey(mission));
  const pct = mission.target > 0 ? Math.min(100, (mission.current / mission.target) * 100) : 0;

  return (
    <Pressable onPress={() => onPress(mission)} style={({ pressed }) => [styles.missionCard, pressed && styles.pressed]}>
      {source ? (
        <Image source={source} style={styles.missionImage} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={["transparent", "rgba(2,7,14,0.72)", "rgba(2,7,14,0.98)"]}
        style={styles.missionOverlay}
      />
      <View style={styles.missionBody}>
        <View style={styles.missionTop}>
          <Text style={styles.missionCategory}>{CATEGORY_LABEL[mission.category] || mission.category}</Text>
          <Text style={styles.missionReward}>+{formatPoints(mission.rewardPoints)} pts</Text>
        </View>
        <Text style={styles.missionTitle} numberOfLines={2}>
          {mission.name}
        </Text>
        <Text style={styles.missionDesc} numberOfLines={2}>
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
          <Text style={styles.missionActionHint}>Progresso</Text>
          <Text style={styles.missionActionState}>{missionActionLabel(mission)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ConversionCard({ item, diamond, onPress, busy }) {
  const source = resolveAsset(item.imageKey);
  const disabled = diamond || busy;

  return (
    <View style={[styles.conversionCard, diamond && styles.conversionCardDiamond]}>
      <View style={styles.conversionArt}>
        {source ? <Image source={source} style={styles.conversionImage} resizeMode="cover" /> : null}
      </View>
      <View style={styles.conversionCopy}>
        <Text style={styles.conversionKicker}>{item.kicker}</Text>
        <Text style={styles.conversionTitle}>{item.title}</Text>
        {diamond ? (
          <Text style={styles.conversionSoon}>EM BREVE</Text>
        ) : (
          <Text style={styles.conversionPrice}>{item.price}</Text>
        )}
        {item.bonus ? <Text style={styles.conversionBonus}>{item.bonus}</Text> : null}
        {!diamond && item.hint ? <Text style={styles.conversionHint}>{item.hint}</Text> : null}
        {diamond ? (
          <Text style={styles.conversionHint}>
            Taxa configurável. Indisponível até a definição no backend.
          </Text>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.conversionBtn,
            diamond && styles.conversionBtnOff,
            disabled && styles.conversionBtnDisabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <Text style={[styles.conversionBtnText, diamond && styles.conversionBtnTextDiamond]}>
            {diamond ? "INDISPONÍVEL" : busy ? "..." : "Converter"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RewardCard({ item, onPress, busy }) {
  const source = resolveAsset(item.imageKey);
  const premium = item.premium || item.currency === "DIAMOND";

  return (
    <View style={[styles.storeItem, premium && styles.storeItemDiamond]}>
      <View style={styles.itemArt}>
        {source ? <Image source={source} style={styles.itemArtImage} resizeMode="cover" /> : null}
      </View>
      <View style={styles.storeInfo}>
        <Text style={[styles.storeType, premium && styles.storeTypeDiamond]}>{catalogTypeLabel(item)}</Text>
        <Text style={styles.storeName}>{item.name}</Text>
        <Text style={styles.storeDesc}>{item.description}</Text>
        <Text style={[styles.storeCost, premium && styles.storeCostDiamond]}>{catalogPriceLabel(item)}</Text>
        <Pressable
          onPress={onPress}
          disabled={busy}
          style={({ pressed }) => [
            styles.storeBtn,
            premium && styles.storeBtnDiamond,
            busy && { opacity: 0.55 },
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={[styles.storeBtnText, premium && styles.storeBtnTextDiamond]}>
            {busy ? "..." : "Resgatar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ShopScreen() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [period, setPeriod] = useState("DAILY");
  const [selectedMission, setSelectedMission] = useState(null);
  const [wallet, setWallet] = useState({ points: 0, gold: 0, diamond: 0 });
  const [missionSummary, setMissionSummary] = useState({});
  const [missions, setMissions] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [goldPackages, setGoldPackages] = useState(GOLD_CONVERSIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const applyWallet = useCallback((next) => {
    if (!next) return;
    setWallet({
      points: Number(next.points || 0),
      gold: Number(next.gold || 0),
      diamond: Number(next.diamond || 0),
    });
  }, []);

  const loadAll = useCallback(
    async (nextPeriod = period) => {
      if (!token) {
        setError(t("auth.sessionExpired"));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const [me, missionList, catalogList, history] = await Promise.all([
          getRewardsMe(token),
          listRewardMissions(token, nextPeriod),
          listRewardCatalog(token),
          listRewardRedemptions(token),
        ]);
        applyWallet(me?.wallet);
        setMissionSummary(me?.missions || {});
        if (Array.isArray(me?.conversions?.pointsToGold) && me.conversions.pointsToGold.length) {
          setGoldPackages(
            GOLD_CONVERSIONS.map((pack) => {
              const fromApi = me.conversions.pointsToGold.find(
                (row) => Number(row.amount) === pack.amount,
              );
              if (!fromApi) return pack;
              return {
                ...pack,
                price: `${formatPoints(fromApi.pointsCost)} pontos`,
              };
            }),
          );
        }
        setMissions(Array.isArray(missionList) ? missionList.map(mapMission) : []);
        setCatalog(Array.isArray(catalogList) ? catalogList : []);
        setRedemptions(Array.isArray(history) ? history : []);
      } catch (err) {
        setMissions([]);
        setCatalog([]);
        setRedemptions([]);
        setError(mapRewardsError(err, t));
      } finally {
        setLoading(false);
      }
    },
    [applyWallet, period, t, token],
  );

  useFocusEffect(
    useCallback(() => {
      loadAll(period);
    }, [loadAll, period]),
  );

  const refreshAfterAction = useCallback(
    async (nextWallet) => {
      applyWallet(nextWallet);
      if (!token) return;
      const [me, missionList, history] = await Promise.all([
        getRewardsMe(token),
        listRewardMissions(token, period),
        listRewardRedemptions(token),
      ]);
      applyWallet(me?.wallet);
      setMissionSummary(me?.missions || {});
      setMissions(Array.isArray(missionList) ? missionList.map(mapMission) : []);
      setRedemptions(Array.isArray(history) ? history : []);
    },
    [applyWallet, period, token],
  );

  const visibleMissions = missions;
  const missionRows = useMemo(() => chunkPairs(visibleMissions), [visibleMissions]);
  const catalogRows = useMemo(() => chunkPairs(catalog), [catalog]);
  const goldRows = useMemo(() => chunkPairs(goldPackages), [goldPackages]);
  const diamondRows = useMemo(() => chunkPairs(DIAMOND_CONVERSIONS), []);
  const periodMeta = PERIOD_TABS.find((tab) => tab.id === period);
  const completedCount =
    missionSummary?.[period]?.completed ?? visibleMissions.filter((m) => m.completed).length;
  const totalCount = missionSummary?.[period]?.total ?? visibleMissions.length;

  function changePeriod(next) {
    setPeriod(next);
    setSelectedMission(null);
  }

  function confirmConvert(pack) {
    if (busy) return;
    Alert.alert(
      "Converter",
      `Converter ${pack.price} em ${pack.amount} Gold? O custo é calculado no servidor.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Converter",
          onPress: async () => {
            if (!token) return;
            setBusy(true);
            try {
              const nextWallet = await convertRewards(token, "POINTS_TO_GOLD", pack.amount);
              await refreshAfterAction(nextWallet);
            } catch (err) {
              Alert.alert("Rewards", mapRewardsError(err, t));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function confirmRedeem(item) {
    if (busy) return;
    Alert.alert(
      "Resgatar",
      `Resgatar "${item.name}" por ${catalogPriceLabel(item)}? O débito é feito no servidor.`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Resgatar",
          onPress: async () => {
            if (!token) return;
            setBusy(true);
            try {
              const result = await redeemReward(token, item.id);
              await refreshAfterAction(result?.wallet);
            } catch (err) {
              Alert.alert("Rewards", mapRewardsError(err, t));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <AppScreen>
      <ImageBackground source={REWARDS_ASSETS.background} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(2,7,15,0.40)", "rgba(2,7,15,0.55)", "rgba(2,7,15,0.94)"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.topbar}>
            <View style={styles.brand}>
              <Image source={REWARDS_ASSETS.hero} style={styles.brandMark} resizeMode="cover" />
              <View style={styles.brandCopy}>
                <Text style={styles.brandTitle}>RuneCodex</Text>
                <Text style={styles.brandSub}>Rewards · Missões · Conquistas</Text>
              </View>
            </View>
          </View>

          <View style={styles.hero}>
            <Image source={REWARDS_ASSETS.hero} style={styles.heroImage} resizeMode="contain" />
            <LinearGradient
              colors={["rgba(0,0,0,0.03)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.62)"]}
              style={styles.heroOverlay}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>Sistema de recompensas</Text>
              <Text style={styles.heroTitle}>REWARDS</Text>
              <Text style={styles.heroSub}>Jogue · Explore · Conquiste · Evolua</Text>
            </View>
          </View>

          {error ? (
            <Pressable onPress={() => loadAll(period)} style={styles.historyEmpty}>
              <Text style={styles.historyEmptyText}>{error}</Text>
              <Text style={[styles.historyEmptyText, { color: GOLD2, marginTop: 8 }]}>Tentar novamente</Text>
            </Pressable>
          ) : null}

          {loading ? <ActivityIndicator color={GOLD2} style={{ marginTop: 16 }} /> : null}

          <View style={styles.summary}>
            <View style={styles.balanceRow}>
              <BalancePill label="Pontos" value={wallet.points} />
              <BalancePill label="Gold" value={wallet.gold} />
              <BalancePill label="Diamond" value={wallet.diamond} tone="diamond" />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>
                  Missões <Text style={styles.sectionTitleGold}>{periodMeta?.label}</Text>
                </Text>
                <Text style={styles.sectionHint}>
                  Escolha um período e complete as atividades para acumular pontos.
                </Text>
              </View>
              <Text style={styles.sectionMeta}>
                {completedCount} / {totalCount} concluídas
              </Text>
            </View>

            <View style={styles.tabs}>
              {PERIOD_TABS.map((tab) => {
                const active = tab.id === period;
                const count = missionSummary?.[tab.id]?.total;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => changePeriod(tab.id)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {tab.label.toUpperCase()}
                      {count != null ? <Text style={styles.tabCount}> {count}</Text> : null}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {missionRows.map((row, index) => (
              <View key={`mission-row-${index}`} style={styles.gridRow}>
                {row.map((mission) => (
                  <View key={mission.id} style={styles.gridCol}>
                    <MissionCard mission={mission} onPress={setSelectedMission} />
                  </View>
                ))}
                {row.length === 1 ? <View style={styles.gridCol} /> : null}
              </View>
            ))}
            {!loading && visibleMissions.length === 0 ? (
              <Text style={styles.note}>Nenhuma missão ativa neste período.</Text>
            ) : null}
            <Text style={styles.note}>
              As abas organizam as missões por ciclo. O conteúdo exibido muda sem alterar o restante do layout.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>
                  Economia <Text style={styles.sectionTitleGold}>RuneCodex</Text>
                </Text>
                <Text style={styles.sectionHint}>
                  Entenda rapidamente como seus pontos viram moedas permanentes.
                </Text>
              </View>
              <Text style={styles.sectionMeta}>3 moedas</Text>
            </View>

            <View style={styles.economy}>
              <View style={styles.economyIntro}>
                <Text style={styles.economyTitle}>PONTOS → GOLD → DIAMOND</Text>
                <Text style={styles.economySub}>
                  Os pontos são conquistados nas missões. Gold e Diamond ficam com você entre as temporadas.
                </Text>
                <View style={styles.balanceRow}>
                  <BalancePill label="Pontos" value={wallet.points} />
                  <BalancePill label="Gold" value={wallet.gold} />
                  <BalancePill label="Diamond" value={wallet.diamond} tone="diamond" />
                </View>
              </View>

              <View style={styles.economyGroup}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle}>Conversão para Gold</Text>
                  <View style={styles.groupLine} />
                </View>
                {goldRows.map((row, index) => (
                  <View key={`gold-row-${index}`} style={styles.gridRow}>
                    {row.map((item) => (
                      <View key={item.id} style={styles.gridCol}>
                        <ConversionCard
                          item={item}
                          busy={busy}
                          onPress={() => confirmConvert(item)}
                        />
                      </View>
                    ))}
                    {row.length === 1 ? <View style={styles.gridCol} /> : null}
                  </View>
                ))}
              </View>

              <View style={styles.economyGroup}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle}>Conversão para Diamond</Text>
                  <View style={styles.groupLine} />
                </View>
                {diamondRows.map((row, index) => (
                  <View key={`diamond-row-${index}`} style={styles.gridRow}>
                    {row.map((item) => (
                      <View key={item.id} style={styles.gridCol}>
                        <ConversionCard item={item} diamond />
                      </View>
                    ))}
                    {row.length === 1 ? <View style={styles.gridCol} /> : null}
                  </View>
                ))}
              </View>

              <View style={styles.economyRule}>
                <Text style={styles.economyRuleText}>
                  <Text style={styles.ruleStrong}>O caminho é direto: </Text>
                  <Text style={styles.ruleGold}>10.000 pontos → 1 Gold</Text>
                  {" · "}
                  <Text style={styles.ruleGold}>45.000 pontos → 5 Golds</Text>
                  {" · "}
                  <Text style={styles.ruleBlue}>Gold → Diamond em breve</Text>
                  .
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>
                  Loja de <Text style={styles.sectionTitleGold}>Recompensas</Text>
                </Text>
                <Text style={styles.sectionHint}>
                  Use seus Golds para resgatar recompensas e Diamonds para itens premium.
                </Text>
              </View>
              <Text style={styles.sectionMeta}>{catalog.length} itens</Text>
            </View>

            {catalogRows.map((row, index) => (
              <View key={`store-row-${index}`} style={styles.gridRow}>
                {row.map((item) => (
                  <View key={item.id} style={styles.gridCol}>
                    <RewardCard item={item} busy={busy} onPress={() => confirmRedeem(item)} />
                  </View>
                ))}
                {row.length === 1 ? <View style={styles.gridCol} /> : null}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadCopy}>
                <Text style={styles.sectionTitle}>
                  Histórico de <Text style={styles.sectionTitleGold}>resgates</Text>
                </Text>
                <Text style={styles.sectionHint}>
                  Status: {Object.values(REDEMPTION_STATUS_LABEL).join(" · ")}
                </Text>
              </View>
            </View>
            {redemptions.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>Nenhum resgate ainda.</Text>
              </View>
            ) : (
              redemptions.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <Text style={styles.storeName}>{item.name || item.reward?.name}</Text>
                  <Text style={styles.storeDesc}>
                    {formatPoints(item.price ?? item.cost)} {item.currency === "DIAMOND" ? "Diamond" : "Gold"} ·{" "}
                    {item.status}
                  </Text>
                  <Text style={styles.storeDesc}>
                    {item.message || REDEMPTION_STATUS_LABEL[item.status] || item.status}
                  </Text>
                  {item.adminNote ? (
                    <Text style={styles.storeDesc}>{item.adminNote}</Text>
                  ) : null}
                  <Text style={styles.storeDesc}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>RuneCodex · Sistema de Rewards</Text>
        </ScrollView>
      </ImageBackground>

      <Modal visible={Boolean(selectedMission)} transparent animationType="fade" onRequestClose={() => setSelectedMission(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMission(null)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {selectedMission ? (
              <>
                <View style={styles.modalHead}>
                  <Text style={styles.modalTitle}>{selectedMission.name}</Text>
                  <Pressable onPress={() => setSelectedMission(null)} hitSlop={12}>
                    <Text style={styles.modalClose}>×</Text>
                  </Pressable>
                </View>
                <Text style={styles.modalText}>
                  {CATEGORY_LABEL[selectedMission.category]} · {selectedMission.description}
                </Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${
                            selectedMission.target > 0
                              ? Math.min(100, (selectedMission.current / selectedMission.target) * 100)
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressCount}>
                    {selectedMission.current} / {selectedMission.target}
                  </Text>
                </View>
                <Text style={styles.modalReward}>
                  Recompensa: +{formatPoints(selectedMission.rewardPoints)} pontos
                </Text>
                <Text style={[styles.modalText, selectedMission.completed && { color: BLUE2 }]}>
                  {selectedMission.completed
                    ? "CONCLUÍDA"
                    : "O progresso atualiza automaticamente quando você realiza a ação no app."}
                </Text>
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
  scroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 40 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
  },
  brandCopy: { flex: 1, minWidth: 0 },
  brandTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", letterSpacing: 0.4 },
  brandSub: { color: Colors.muted, fontSize: 12, marginTop: 3 },

  hero: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.48)",
    backgroundColor: "#050b15",
  },
  heroImage: { width: "100%", height: "100%", backgroundColor: "#050b15" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroCopy: { position: "absolute", left: 18, right: 18, bottom: 17 },
  heroKicker: {
    color: GOLD2,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { color: Colors.text, fontSize: 27, fontWeight: "800", letterSpacing: 0.6 },
  heroSub: { color: "#d6dfeb", marginTop: 5, fontSize: 11 },

  summary: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
    backgroundColor: "rgba(5,15,29,0.91)",
  },
  balanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  balancePill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  balancePillDiamond: { borderColor: "rgba(44,169,255,0.28)" },
  balancePillText: { color: "#b8c6d6", fontSize: 10, fontWeight: "700" },
  balanceValue: { color: GOLD2, fontWeight: "800" },
  balanceValueDiamond: { color: BLUE2 },

  section: { marginTop: 24 },
  sectionHead: { marginBottom: 12, gap: 6 },
  sectionHeadCopy: { minWidth: 0 },
  sectionTitle: { color: Colors.text, fontSize: 22, fontWeight: "800" },
  sectionTitleGold: { color: GOLD2 },
  sectionHint: { color: Colors.muted, fontSize: 11, marginTop: 4, lineHeight: 16 },
  sectionMeta: { color: Colors.muted, fontSize: 11 },

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
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: "#f0ce6b",
  },
  tabText: {
    color: "#8796aa",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  tabTextActive: { color: "#1a1307" },
  tabCount: { opacity: 0.75 },

  gridRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  gridCol: { flex: 1, minWidth: 0 },

  missionCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.34)",
    backgroundColor: "rgba(4,12,24,0.86)",
  },
  missionImage: { width: "100%", aspectRatio: 300 / 332 },
  missionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
  },
  missionBody: { position: "absolute", left: 10, right: 10, bottom: 10 },
  missionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  missionCategory: { color: Colors.text, fontSize: 10, fontWeight: "800", flex: 1 },
  missionReward: { color: GOLD2, fontWeight: "800", fontSize: 10 },
  missionTitle: { color: Colors.text, fontWeight: "700", fontSize: 12, marginTop: 4 },
  missionDesc: { color: "#b8c5d5", fontSize: 9, marginTop: 3, lineHeight: 12 },
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
  progressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: BLUE,
  },
  progressCount: { color: "#d0d9e5", fontSize: 9, fontWeight: "700" },
  missionAction: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  missionActionHint: { color: "#8d9cb0", fontSize: 9 },
  missionActionState: { color: BLUE2, fontWeight: "800", fontSize: 9 },
  note: { color: "#7e8da2", fontSize: 10, marginTop: 2 },

  economy: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.34)",
    backgroundColor: "rgba(4,12,23,0.96)",
  },
  economyIntro: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  economyTitle: { color: GOLD2, fontSize: 18, fontWeight: "800" },
  economySub: { color: Colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4, marginBottom: 10 },
  economyGroup: { paddingHorizontal: 12, paddingTop: 14 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  groupTitle: { color: "#f0d273", fontSize: 14, fontWeight: "800" },
  groupLine: { flex: 1, height: 1, backgroundColor: "rgba(217,173,63,0.32)" },

  conversionCard: {
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.24)",
    backgroundColor: "rgba(9,21,37,0.92)",
  },
  conversionCardDiamond: { borderColor: "rgba(78,178,255,0.28)" },
  conversionArt: { width: "100%", aspectRatio: 1, backgroundColor: "#02050a" },
  conversionImage: { width: "100%", height: "100%" },
  conversionCopy: { padding: 10 },
  conversionKicker: {
    color: "#8494a8",
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  conversionTitle: { color: Colors.text, fontSize: 14, fontWeight: "800", marginTop: 3 },
  conversionPrice: { color: GOLD2, fontSize: 12, fontWeight: "800", marginTop: 6 },
  conversionSoon: { color: BLUE2, fontSize: 12, fontWeight: "800", marginTop: 6 },
  conversionBonus: { color: BLUE2, fontSize: 9, fontWeight: "800", marginTop: 4 },
  conversionHint: { color: "#8e9db0", fontSize: 9, lineHeight: 13, marginTop: 4 },
  conversionBtn: {
    marginTop: 8,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.48)",
    backgroundColor: "rgba(217,173,63,0.07)",
    alignItems: "center",
  },
  conversionBtnOff: {
    borderColor: "rgba(78,178,255,0.38)",
    backgroundColor: "rgba(44,169,255,0.06)",
  },
  conversionBtnDisabled: { opacity: 0.55 },
  conversionBtnText: { color: GOLD2, fontSize: 9, fontWeight: "800" },
  conversionBtnTextDiamond: { color: BLUE2 },

  economyRule: {
    margin: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(44,169,255,0.16)",
    backgroundColor: "rgba(3,12,24,0.65)",
  },
  economyRuleText: { color: "#9eafc3", fontSize: 9, lineHeight: 14 },
  ruleStrong: { color: "#e4ebf4", fontWeight: "800" },
  ruleGold: { color: GOLD2, fontWeight: "800" },
  ruleBlue: { color: BLUE2, fontWeight: "800" },

  storeItem: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.28)",
    backgroundColor: "rgba(8,19,35,0.96)",
  },
  storeItemDiamond: {
    borderColor: "rgba(78,178,255,0.52)",
  },
  itemArt: { width: "100%", aspectRatio: 1, backgroundColor: "#020509" },
  itemArtImage: { width: "100%", height: "100%" },
  storeInfo: { padding: 10 },
  storeType: {
    color: GOLD2,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  storeTypeDiamond: { color: BLUE2 },
  storeName: { color: Colors.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  storeDesc: { color: Colors.muted, fontSize: 9, marginTop: 5, minHeight: 26, lineHeight: 13 },
  storeCost: { color: GOLD2, fontWeight: "800", fontSize: 12, marginTop: 4 },
  storeCostDiamond: { color: BLUE2 },
  storeBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: GOLD,
  },
  storeBtnDiamond: {
    borderColor: "rgba(78,178,255,0.65)",
    backgroundColor: BLUE,
  },
  storeBtnText: { color: "#171106", fontWeight: "800", fontSize: 11 },
  storeBtnTextDiamond: { color: "#071421" },

  historyEmpty: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.22)",
    backgroundColor: "rgba(4,12,24,0.8)",
  },
  historyEmptyText: { color: Colors.muted, fontSize: 12, fontWeight: "700" },
  historyRow: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,173,63,0.22)",
    backgroundColor: "rgba(4,12,24,0.8)",
    gap: 4,
  },

  footer: { textAlign: "center", color: "#7e8ca0", fontSize: 10, marginTop: 22 },

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
  modalText: { color: Colors.muted, fontSize: 12, lineHeight: 19, marginTop: 12 },
  modalReward: { color: GOLD2, fontWeight: "700", marginTop: 12 },
});
