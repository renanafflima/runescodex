import React, { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "@/src/store/AppStore";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppChip from "@/components/ui/AppChip";

const EMPTY_FORM = { name: "", vocation: "", level: "", world: "" };

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 401) return t("auth.sessionExpired");
  if (error?.status === 400) return t("characters.invalidPayload");
  return t("auth.genericError");
}

export default function ProfileScreen() {
  const router = useRouter();
  const { points, redemptions, quests } = useAppStore();
  const {
    user,
    characters,
    activeCharacter,
    logout,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setActiveCharacter,
    fetchCharacter,
  } = useAuth();
  const { t, locale, setLocale, locales } = useI18n();

  const openTickets = (quests || []).filter((q) => q.status === "open").length;
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setFormOpen(true);
  }

  async function openEdit(character) {
    setError("");
    try {
      const fresh = await fetchCharacter(character.id);
      setEditingId(fresh.id);
      setForm({
        name: fresh.name || "",
        vocation: fresh.vocation || "",
        level: String(fresh.level ?? ""),
        world: fresh.world || "",
      });
      setFormOpen(true);
    } catch (err) {
      Alert.alert(t("common.error"), mapError(err, t));
    }
  }

  async function submitCharacter() {
    setError("");
    const name = form.name.trim();
    const vocation = form.vocation.trim();
    const world = form.world.trim();
    const level = Number(form.level);
    if (!name || !vocation || !world || !Number.isInteger(level) || level < 1) {
      setError(t("characters.invalidPayload"));
      return;
    }
    setBusy(true);
    try {
      const payload = { name, vocation, level, world };
      if (editingId) {
        await updateCharacter(editingId, payload);
      } else {
        await createCharacter(payload);
      }
      setFormOpen(false);
    } catch (err) {
      setError(mapError(err, t));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(character) {
    Alert.alert(t("characters.delete"), t("characters.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.remove"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCharacter(character.id);
          } catch (err) {
            Alert.alert(t("common.error"), mapError(err, t));
          }
        },
      },
    ]);
  }

  async function activate(character) {
    try {
      await setActiveCharacter(character.id);
    } catch (err) {
      Alert.alert(t("common.error"), mapError(err, t));
    }
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RC</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("profile.title")}</Text>
            <Text style={styles.subtitle}>{t("profile.subtitle")}</Text>
          </View>
        </View>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.account")}</Text>
          <Text style={styles.meta}>{user?.email || "—"}</Text>
          <View style={styles.stats}>
            <Stat label={t("profile.points")} value={String(points ?? 0)} />
            <Stat label={t("profile.redemptions")} value={String((redemptions || []).length)} />
            <Stat label={t("profile.openTickets")} value={String(openTickets)} />
          </View>
          <AppButton label={t("auth.logout")} variant="ghost" onPress={logout} />
        </AppCard>

        <AppCard>
          <Text style={styles.cardTitle}>{t("characters.title")}</Text>
          <Text style={styles.subtitle}>
            {activeCharacter
              ? `${t("characters.active")}: ${activeCharacter.name}`
              : t("characters.noneActive")}
          </Text>
          {(characters || []).length === 0 ? (
            <Text style={styles.subtitle}>{t("characters.empty")}</Text>
          ) : (
            characters.map((item) => {
              const isActive = activeCharacter?.id === item.id;
              return (
                <View key={item.id} style={styles.character}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rewardTitle}>{item.name}</Text>
                    {isActive ? <AppChip label={t("characters.active")} active /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {item.vocation} • {t("characters.level")} {item.level} • {item.world}
                  </Text>
                  <View style={styles.row}>
                    {!isActive ? (
                      <AppButton
                        label={t("characters.setActive")}
                        variant="secondary"
                        onPress={() => activate(item)}
                        style={styles.smallBtn}
                      />
                    ) : null}
                    <AppButton
                      label={t("characters.edit")}
                      variant="ghost"
                      onPress={() => openEdit(item)}
                      style={styles.smallBtn}
                    />
                    <AppButton
                      label={t("common.remove")}
                      variant="danger"
                      onPress={() => confirmDelete(item)}
                      style={styles.smallBtn}
                    />
                  </View>
                </View>
              );
            })
          )}
          <AppButton label={t("characters.create")} onPress={openCreate} />
        </AppCard>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.language")}</Text>
          <View style={styles.row}>
            {locales.map((item) => (
              <AppChip
                key={item.id}
                label={item.label}
                active={locale === item.id}
                onPress={() => setLocale(item.id)}
              />
            ))}
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.cardTitle}>{t("profile.rewards")}</Text>
          {(redemptions || []).length === 0 ? (
            <Text style={styles.subtitle}>{t("profile.noRewards")}</Text>
          ) : (
            (redemptions || []).slice(0, 5).map((item) => (
              <View key={item.id} style={styles.reward}>
                <Text style={styles.rewardTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.cost} pts</Text>
              </View>
            ))
          )}
          <AppButton label={t("profile.goStore")} onPress={() => router.push("/(tabs)/shop")} />
          <AppButton
            label={t("profile.goTickets")}
            variant="secondary"
            onPress={() => router.push("/(tabs)/quest-board")}
          />
        </AppCard>
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>
              {editingId ? t("characters.edit") : t("characters.create")}
            </Text>
            <Field label={t("characters.name")} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} />
            <Field
              label={t("characters.vocation")}
              value={form.vocation}
              onChangeText={(v) => setForm((p) => ({ ...p, vocation: v }))}
              autoCapitalize="characters"
            />
            <Field
              label={t("characters.level")}
              value={form.level}
              onChangeText={(v) => setForm((p) => ({ ...p, level: v }))}
              keyboardType="numeric"
            />
            <Field label={t("characters.world")} value={form.world} onChangeText={(v) => setForm((p) => ({ ...p, world: v }))} />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <AppButton label={busy ? t("common.loading") : t("common.save")} onPress={submitCharacter} disabled={busy} />
            <AppButton label={t("common.close")} variant="ghost" onPress={() => setFormOpen(false)} />
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 14, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(212,167,44,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.goldLight, fontWeight: "800" },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  cardTitle: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  meta: { color: Colors.textMuted, fontSize: Type.tiny },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
  },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  statValue: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.card, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reward: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
  },
  character: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    backgroundColor: Colors.bgSecondary,
    gap: 8,
  },
  rewardTitle: { color: Colors.text, fontWeight: "800", fontSize: Type.body },
  smallBtn: { minHeight: 40, paddingHorizontal: 10 },
  error: { color: Colors.danger, fontSize: Type.secondary },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: Colors.cardElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 10,
    color: Colors.text,
  },
});
