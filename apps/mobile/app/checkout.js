import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { syncStorePremium } from "@/src/api/billing";
import {
  getLifetimePremiumPackage,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "@/src/api/revenuecat";
import { mobileGate } from "@/src/domain/premium-access";
import { useI18n } from "@/src/i18n";
import { Colors, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

export default function CheckoutScreen() {
  const {
    isReady,
    isAuthenticated,
    premiumAccess,
    user,
    token,
    refreshMe,
    reloadCharacters,
  } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [loadedForUserId, setLoadedForUserId] = useState(null);
  const [storePackage, setStorePackage] = useState(null);
  const [error, setError] = useState("");
  const loadingProduct = loadedForUserId !== user?.id;
  const gate = mobileGate({ isReady, isAuthenticated, premiumAccess });

  useEffect(() => {
    let current = true;
    getLifetimePremiumPackage(user?.id)
      .then((nextPackage) => {
        if (!current) return;
        setLoadedForUserId(user?.id);
        setStorePackage(nextPackage);
        if (!nextPackage) setError(t("premium.unavailable"));
      })
      .catch((loadError) => {
        console.warn("RevenueCat offering load failed.", loadError);
        if (current) {
          setLoadedForUserId(user?.id);
          setStorePackage(null);
          setError(t("premium.unavailable"));
        }
      });
    return () => {
      current = false;
    };
  }, [user?.id, t]);

  if (gate === "loading") return null;
  if (gate === "public") return <Redirect href="/(auth)/login" />;
  if (gate === "app") return <Redirect href="/(tabs)" />;

  async function syncPurchase() {
    const premium = await syncStorePremium(token);
    await refreshMe();
    if (premium.access) {
      await reloadCharacters();
    }
    return premium;
  }

  function showPurchaseError(purchaseError) {
    if (purchaseError?.userCancelled) return;
    console.warn("Native Premium purchase failed.", purchaseError);
    setError(
      purchaseError?.status === 503
        ? t("premium.unavailable")
        : t("premium.error"),
    );
  }

  async function buy() {
    if (!storePackage) {
      setError(t("premium.unavailable"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await purchaseRevenueCatPackage(storePackage);
      const premium = await syncPurchase();
      if (!premium.access) setError(t("premium.pending"));
    } catch (purchaseError) {
      showPurchaseError(purchaseError);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError("");
    try {
      const customerInfo = await restoreRevenueCatPurchases(user?.id);
      if (!customerInfo) {
        setError(t("premium.unavailable"));
        return;
      }
      const premium = await syncPurchase();
      if (!premium.access) setError(t("premium.notFound"));
    } catch (restoreError) {
      showPurchaseError(restoreError);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const premium = await syncPurchase();
      if (!premium.access) setError(t("premium.pending"));
    } catch (syncError) {
      showPurchaseError(syncError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <AppCard>
        <Text style={styles.eyebrow}>RuneCodex Premium</Text>
        <Text style={styles.title}>{t("premium.title")}</Text>
        <Text style={styles.body}>{t("premium.body")}</Text>
        {storePackage ? (
          <Text style={styles.price}>
            {t("premium.price", { price: storePackage.product.priceString })}
          </Text>
        ) : null}
        <Text style={styles.body}>{t("premium.server")}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <AppButton
            label={
              loadingProduct || busy
                ? t("common.loading")
                : t("premium.buy")
            }
            onPress={buy}
            disabled={busy || loadingProduct || !storePackage}
          />
          <AppButton
            label={t("premium.restore")}
            onPress={restore}
            disabled={busy || loadingProduct}
          />
          <AppButton
            label={t("premium.refresh")}
            onPress={refresh}
            disabled={busy || loadingProduct}
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: Colors.goldLight,
    fontSize: Type.tiny,
    marginBottom: Spacing.sm,
  },
  title: { color: Colors.text, fontSize: Type.screen, marginBottom: Spacing.sm },
  body: { color: Colors.textMuted, fontSize: Type.body, marginBottom: Spacing.sm },
  price: { color: Colors.goldLight, fontSize: Type.body, marginBottom: Spacing.sm },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
});
