import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppStore } from "../../src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";

/**
 * ✅ ÍCONES:
 * Salve as imagens aqui:
 * apps/mobile/assets/ui/shop-items/
 *
 * Itens "normais" (points):
 * - s1.png
 * - s2.png
 * - s3.png
 * - s4.png
 *
 * Itens especiais (Ferumbras Coins):
 * - f1.png
 * - f2.png
 * - f3.png
 */
const SHOP_ICONS = {
  s1: require("../../assets/shop-items/tibiac.png"),
  s2: require("../../assets/shop-items/rubinic.png"),
  s3: require("../../assets/shop-items/netshoes.png"),
  s4: require("../../assets/shop-items/ferumbras_coin.png"),

  f1: require("../../assets/shop-items/ferumbras_coin.png"),
  f2: require("../../assets/shop-items/Sanguine_Hatchet.gif"),
  f3: require("../../assets/shop-items/f3.png"),
};

// ✅ Background da tela Shop
// Coloque em: apps/mobile/assets/ui/shop-bg.png
const shopBg = require("@/assets/ui/shop2.png");

const SHOP_ITEMS = [
  { id: "s1", title: "50 Tibia Coins", cost: 100, currency: "points", description: "Resgate simbólico (mock)" },
  { id: "s2", title: "50 Rubini Coins", cost: 100, currency: "points", description: "Resgate simbólico (mock)" },
  { id: "s3", title: "10% Desconto Netshoes", cost: 250, currency: "points", description: "Cupom simbólico (mock)" },
  { id: "s4", title: "Ferumbras Coin", cost: 50, currency: "points", description: "Emblema dentro do app (mock)" },

  {
    id: "f1",
    title: "Ferumbras Hat",
    cost: 5,
    currency: "ferumbras",
    description: "Item especial pago com Ferumbras Coins (mock).",
  },
  {
    id: "f2",
    title: "Sanguine Hatchet",
    cost: 8,
    currency: "ferumbras",
    description: "Arma especial paga com Ferumbras Coins (mock).",
  },
  {
    id: "f3",
    title: "R$ 3000 no Pix",
    cost: 25,
    currency: "ferumbras",
    description: "Recompensa premium paga com Ferumbras Coins (mock).",
  },
];

export default function ShopScreen() {
  const { t } = useI18n();
  const { userId, points, redemptions, actions } = useAppStore();

  const [tab, setTab] = useState("items"); // items | history
  const [itemsOpen, setItemsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // ✅ Mock por enquanto
  const [ferumbrasCoins, setFerumbrasCoins] = useState(12);

  const redemptionsCount = useMemo(() => (redemptions || []).length, [redemptions]);

  function confirmRedeem(item) {
    const isSpecial = item.currency === "ferumbras";
    const hasBalance = isSpecial ? ferumbrasCoins >= item.cost : points >= item.cost;

    if (!hasBalance) return;

    Alert.alert(
      t("store.confirm"),
      t("store.confirmMsg", {
        title: item.title,
        cost: item.cost,
        currency: isSpecial ? t("store.ferumbras") : t("store.points"),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("store.redeem"),
          onPress: () => {
            if (isSpecial) setFerumbrasCoins((v) => Math.max(0, v - item.cost));

            const res = actions.redeem({
              itemId: item.id,
              title: item.title,
              cost: item.cost,
              currency: item.currency,
            });

            Alert.alert(res.ok ? t("store.success") : t("store.error"), res.message);
          },
        },
      ]
    );
  }

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("store.title")}</Text>
        <Text style={styles.subtitle}>{t("store.subtitle")}</Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t("store.points")}: {points}</Text>
          </View>

          <View style={[styles.pill, styles.pillSpecial]}>
            <Text style={styles.pillText}>Ferumbras: {ferumbrasCoins}</Text>
          </View>

          <View style={styles.pill}>
            <Text style={styles.pillText}>{t("store.history")}: {redemptionsCount}</Text>
          </View>
        </View>

        <Text style={{ color: COLORS.muted, marginTop: 8, fontWeight: "800", fontSize: 12 }}>
          Seu ID: {userId}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visualização</Text>
        <View style={styles.chipsRow}>
          <Chip label={t("store.items")} active={tab === "items"} onPress={() => setTab("items")} />
          <Chip label={t("store.history")} active={tab === "history"} onPress={() => setTab("history")} />
        </View>
      </View>

      {tab === "items" && (
        <View style={styles.card}>
          <Pressable
            onPress={() => setItemsOpen((s) => !s)}
            style={({ pressed }) => [styles.rowBetween, pressed && styles.pressed]}
          >
            <Text style={styles.cardTitle}>{t("store.available")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{itemsOpen ? "Minimizar ▲" : "Expandir ▼"}</Text>
            </View>
          </Pressable>

          {itemsOpen && (
            <View style={{ gap: 8 }}>
              <Text style={styles.helperText}>
                Itens normais usam <Text style={{ fontWeight: "900", color: COLORS.text }}>Pontos</Text>.
              </Text>
              <Text style={styles.helperText}>
                Itens especiais usam <Text style={{ fontWeight: "900", color: COLORS.specialText }}>Ferumbras Coins</Text>.
              </Text>
            </View>
          )}
        </View>
      )}

      {tab === "history" && (
        <View style={styles.card}>
          <Pressable
            onPress={() => setHistoryOpen((s) => !s)}
            style={({ pressed }) => [styles.rowBetween, pressed && styles.pressed]}
          >
            <Text style={styles.cardTitle}>{t("store.historyTitle")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{historyOpen ? "Minimizar ▲" : "Expandir ▼"}</Text>
            </View>
          </Pressable>

          {historyOpen && (
            <View style={{ gap: 8 }}>
              <Text style={styles.helperText}>Aqui aparecem os resgates feitos no app (mock).</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Pressable
          onPress={() => {
            Alert.alert(t("store.reset"), t("store.resetMsg"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("store.reset"), style: "destructive", onPress: () => actions.resetAll() },
            ]);
          }}
          style={({ pressed }) => [styles.devBtn, pressed && styles.pressed]}
        >
          <Text style={styles.devText}>{t("store.reset")}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <AppScreen>
      <ImageBackground source={shopBg} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.72)",
            "rgba(0,0,0,0.28)",
            "rgba(0,0,0,0.84)",
          ]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {tab === "items" ? (
          <FlatList
            data={itemsOpen ? SHOP_ITEMS : []}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={header}
            renderItem={({ item }) => {
              const isSpecial = item.currency === "ferumbras";
              const balance = isSpecial ? ferumbrasCoins : points;

              const canRedeem = balance >= item.cost;
              const pct = clampPct(item.cost > 0 ? (balance / item.cost) * 100 : 0);
              const missing = Math.max(0, item.cost - balance);

              const iconSource = SHOP_ICONS[item.id];

              return (
                <View
                  style={[
                    styles.card,
                    styles.itemCard,
                    isSpecial && styles.cardSpecial,
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.itemLeft}>
                      <View style={[styles.iconWrap, isSpecial && styles.iconWrapSpecial]}>
                        {iconSource ? (
                          <Image source={iconSource} style={styles.icon} resizeMode="contain" />
                        ) : (
                          <Text style={[styles.iconFallback, isSpecial && { color: COLORS.specialText }]}>?</Text>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Text style={styles.itemTitle}>{item.title}</Text>

                          {isSpecial ? (
                            <View style={[styles.currencyBadge, styles.currencyBadgeSpecial]}>
                              <Text style={[styles.currencyBadgeText, { color: COLORS.specialText }]}>
                                Ferumbras
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.currencyBadge}>
                              <Text style={styles.currencyBadgeText}>Pontos</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.itemDesc}>{item.description}</Text>
                      </View>
                    </View>

                    <View style={[styles.badgeSoft, isSpecial && styles.badgeSoftSpecial]}>
                      <Text style={[styles.badgeSoftText, isSpecial && { color: COLORS.specialText }]}>
                        {item.cost} {isSpecial ? "FC" : "pts"}
                      </Text>
                    </View>
                  </View>

                  {!canRedeem && (
                    <View style={[styles.progressWrap, isSpecial && styles.progressWrapSpecial]}>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Progresso</Text>
                        <Text style={styles.progressValue}>{pct}%</Text>
                      </View>

                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            isSpecial && styles.progressFillSpecial,
                            { width: `${pct}%` },
                          ]}
                        />
                      </View>

                      <Text style={styles.progressHint}>
                        Faltam{" "}
                        <Text style={{ color: isSpecial ? COLORS.specialText : COLORS.gold, fontWeight: "900" }}>
                          {missing}
                        </Text>{" "}
                        {isSpecial ? "Ferumbras Coins" : "pontos"} para resgatar.
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => confirmRedeem(item)}
                    disabled={!canRedeem}
                    style={({ pressed }) => [
                      styles.redeemBtn,
                      isSpecial && styles.redeemBtnSpecial,
                      pressed && styles.pressed,
                      !canRedeem && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={[styles.redeemText, isSpecial && { color: COLORS.specialText }]}>
                      {t("store.redeem")}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
          />
        ) : (
          <FlatList
            data={historyOpen ? (redemptions || []) : []}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
              <View style={[styles.card, styles.itemCard]}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>
                  Custo: {item.cost} {item.currency === "ferumbras" ? "Ferumbras Coins" : "pontos"}
                </Text>
                <Text style={styles.dateText}>Em: {new Date(item.createdAt).toLocaleString("pt-BR")}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: COLORS.muted, marginTop: 12, paddingHorizontal: 16 }}>
                {t("store.empty")}
              </Text>
            }
          />
        )}
      </ImageBackground>
    </AppScreen>
  );
}

function clampPct(v) {
  const n = Number.isFinite(v) ? v : 0;
  const c = Math.max(0, Math.min(100, Math.round(n)));
  return c;
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={
          active
            ? ["rgba(217,146,84,0.20)", "rgba(43,58,184,0.18)"]
            : ["rgba(109,120,225,0.14)", "rgba(43,58,184,0.10)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg0,
  },

  bg: {
    flex: 1,
  },

  headerWrap: { padding: 16, gap: 12 },
  listContent: { paddingBottom: 24, gap: 12 },

  header: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 12, 35, 0.50)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: COLORS.muted, marginTop: 6, lineHeight: 18 },

  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 3 },
    }),
  },

  itemCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(15, 12, 35, 0.68)",
  },

  cardSpecial: {
    backgroundColor: COLORS.specialCard,
    borderColor: COLORS.specialBorder,
  },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(109,120,225,0.10)",
  },
  pillSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.10)",
  },
  pillText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },

  helperText: { color: COLORS.muted, fontWeight: "800", lineHeight: 18 },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },
  chipActive: { borderColor: "rgba(217,146,84,0.45)" },
  chipText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  pressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },

  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconWrapSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.10)",
  },
  icon: { width: 30, height: 30 },
  iconFallback: { color: COLORS.muted, fontWeight: "900" },

  itemTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  itemDesc: { color: COLORS.muted, fontWeight: "800", lineHeight: 18 },

  currencyBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.25)",
  },
  currencyBadgeSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.10)",
  },
  currencyBadgeText: { color: COLORS.muted, fontWeight: "900", fontSize: 11 },

  badgeSoft: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.25)",
  },
  badgeSoftSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.10)",
  },
  badgeSoftText: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },

  redeemBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(217,146,84,0.45)",
    backgroundColor: "rgba(217,146,84,0.12)",
  },
  redeemBtnSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.10)",
  },
  redeemText: { color: COLORS.gold, fontWeight: "900" },

  dateText: { color: "rgba(231,231,221,0.55)", fontWeight: "800", fontSize: 12 },

  devBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
  },
  devText: { color: COLORS.text, fontWeight: "900" },

  progressWrap: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
    gap: 10,
  },
  progressWrapSpecial: {
    borderColor: COLORS.specialBorder,
    backgroundColor: "rgba(192,123,255,0.08)",
  },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  progressValue: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(217,146,84,0.65)",
  },
  progressFillSpecial: {
    backgroundColor: COLORS.specialFill,
  },
  progressHint: { color: COLORS.muted, fontWeight: "800", fontSize: 12, lineHeight: 16 },
});