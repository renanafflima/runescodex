import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

function mapAuthError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 409) return t("auth.emailInUse");
  if (error?.status === 400) return t("auth.invalidPayload");
  return t("auth.genericError");
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    if (!email.trim() || !password) {
      setError(t("auth.required"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordMin"));
      return;
    }
    setBusy(true);
    try {
      await register(email.trim(), password);
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <View style={styles.content}>
        <Text style={styles.title}>{t("auth.registerTitle")}</Text>
        <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>
        <AppCard>
          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={t("auth.email")}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.label}>{t("auth.password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t("auth.password")}
            placeholderTextColor={Colors.textMuted}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <AppButton label={busy ? t("common.loading") : t("auth.register")} onPress={onSubmit} disabled={busy} />
          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkWrap}>
            <Text style={styles.link}>{t("auth.hasAccount")}</Text>
          </Pressable>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 12 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  label: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 10,
    color: Colors.text,
  },
  error: { color: Colors.danger, fontSize: Type.secondary },
  linkWrap: { alignItems: "center", paddingVertical: 6 },
  link: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.secondary },
});
