import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { mobileGate } from "@/src/domain/premium-access";
import { useI18n } from "@/src/i18n";
import { Colors, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppButton from "@/components/ui/AppButton";

export default function Index() {
  const { isReady, isAuthenticated, premiumAccess } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const gate = mobileGate({ isReady, isAuthenticated, premiumAccess });

  if (gate === "loading") return null;
  if (gate === "checkout") return <Redirect href="/checkout" />;
  if (gate === "app") return <Redirect href="/(tabs)" />;

  return (
    <AppScreen>
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>RuneCodex</Text>
        <Text style={styles.title}>{t("premium.homeTitle")}</Text>
        <Text style={styles.body}>{t("premium.homeBody")}</Text>
        <AppButton label={t("auth.login")} onPress={() => router.push("/(auth)/login")} />
        <AppButton label={t("auth.register")} onPress={() => router.push("/(auth)/register")} />
        <Pressable onPress={() => router.push("/checkout")}>
          <Text style={styles.link}>{t("premium.title")}</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, paddingTop: Spacing.xl },
  eyebrow: { color: Colors.goldLight, fontSize: Type.tiny },
  title: { color: Colors.text, fontSize: Type.screen },
  body: { color: Colors.textMuted, fontSize: Type.body },
  link: { color: Colors.goldLight, fontSize: Type.body },
});
