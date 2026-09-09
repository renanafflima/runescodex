import React, { useMemo, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppStore } from "@/src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppChip from "@/components/ui/AppChip";
import EmptyState from "@/components/ui/EmptyState";

function formatBR(n) {
  return Number(n || 0).toLocaleString("pt-BR");
}

const EMPTY_FORM = {
  type: "hunt",
  huntName: "",
  vocation: "",
  level: "",
  xp: "",
  profit: "",
  durationMin: "",
  loot: "",
  boss: "",
  items: "",
  notes: "",
};

export default function TrackerScreen() {
  const { sessions, actions } = useAppStore();
  const { t } = useI18n();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = useMemo(() => {
    if (tab === "boss") return sessions.filter((s) => s.type === "boss");
    if (tab === "profit") return sessions.filter((s) => Number(s.profit) > 0);
    return sessions;
  }, [sessions, tab]);

  const totals = useMemo(() => {
    return sessions.reduce(
      (acc, s) => {
        acc.xp += Number(s.xp) || 0;
        acc.profit += Number(s.profit) || 0;
        return acc;
      },
      { xp: 0, profit: 0 }
    );
  }, [sessions]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    actions.createSession(form);
    setForm(EMPTY_FORM);
    setOpen(false);
  }

  return (
    <AppScreen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>{t("tracker.title")}</Text>
            <Text style={styles.subtitle}>{t("tracker.subtitle")}</Text>

            <View style={styles.stats}>
              <Stat label={t("tracker.totalXp")} value={formatBR(totals.xp)} />
              <Stat label={t("tracker.totalProfit")} value={formatBR(totals.profit)} />
              <Stat label={t("tracker.sessions")} value={String(sessions.length)} />
            </View>

            <View style={styles.row}>
              <AppChip label={t("tracker.tabAll")} active={tab === "all"} onPress={() => setTab("all")} />
              <AppChip label={t("tracker.tabProfit")} active={tab === "profit"} onPress={() => setTab("profit")} />
              <AppChip label={t("tracker.tabBoss")} active={tab === "boss"} onPress={() => setTab("boss")} />
            </View>

            <AppButton label={t("tracker.register")} onPress={() => setOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <AppCard>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.huntName || item.boss}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.type === "boss" ? t("tracker.typeBoss") : t("tracker.typeHunt")}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              {!!item.xp && <Meta label={t("tracker.xp")} value={formatBR(item.xp)} />}
              {!!item.profit && <Meta label={t("tracker.profit")} value={formatBR(item.profit)} />}
              {!!item.durationMin && <Meta label={t("tracker.duration")} value={String(item.durationMin)} />}
              {!!item.vocation && <Meta label={t("tracker.vocation")} value={item.vocation} />}
              {!!item.level && <Meta label={t("tracker.level")} value={String(item.level)} />}
            </View>
            {!!item.loot && <Text style={styles.body}>{t("tracker.loot")}: {item.loot}</Text>}
            {!!item.items && <Text style={styles.body}>{t("tracker.items")}: {item.items}</Text>}
            {!!item.notes && <Text style={styles.body}>{item.notes}</Text>}
            <AppButton
              label={t("common.remove")}
              variant="danger"
              onPress={() => actions.deleteSession(item.id)}
            />
          </AppCard>
        )}
        ListEmptyComponent={
          <EmptyState
            title={t("tracker.empty")}
            hint={t("tracker.emptyHint")}
            actionLabel={t("tracker.register")}
            onAction={() => setOpen(true)}
          />
        }
      />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>{t("tracker.register")}</Text>
            <View style={styles.row}>
              <AppChip label={t("tracker.typeHunt")} active={form.type === "hunt"} onPress={() => setField("type", "hunt")} />
              <AppChip label={t("tracker.typeBoss")} active={form.type === "boss"} onPress={() => setField("type", "boss")} />
            </View>
            <Field label={t("tracker.huntName")} value={form.huntName} onChangeText={(v) => setField("huntName", v)} />
            {form.type === "boss" && (
              <Field label={t("tracker.boss")} value={form.boss} onChangeText={(v) => setField("boss", v)} />
            )}
            <View style={styles.grid}>
              <Field label={t("tracker.vocation")} value={form.vocation} onChangeText={(v) => setField("vocation", v)} />
              <Field label={t("tracker.level")} value={form.level} onChangeText={(v) => setField("level", v)} keyboardType="numeric" />
              <Field label={t("tracker.xp")} value={form.xp} onChangeText={(v) => setField("xp", v)} keyboardType="numeric" />
              <Field label={t("tracker.profit")} value={form.profit} onChangeText={(v) => setField("profit", v)} keyboardType="numeric" />
              <Field label={t("tracker.duration")} value={form.durationMin} onChangeText={(v) => setField("durationMin", v)} keyboardType="numeric" />
            </View>
            <Field label={t("tracker.loot")} value={form.loot} onChangeText={(v) => setField("loot", v)} />
            <Field label={t("tracker.items")} value={form.items} onChangeText={(v) => setField("items", v)} />
            <Field label={t("tracker.notes")} value={form.notes} onChangeText={(v) => setField("notes", v)} />
            <AppButton label={t("common.save")} onPress={submit} />
            <AppButton label={t("common.close")} variant="ghost" onPress={() => setOpen(false)} />
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

function Meta({ label, value }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ gap: 6, flexGrow: 1, flexBasis: "48%" }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: 12, paddingBottom: 28 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  cardTitle: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  body: { color: Colors.textSecondary, fontSize: Type.secondary, lineHeight: 18 },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
  },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  statValue: { color: Colors.goldLight, fontWeight: "800", fontSize: Type.card, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  meta: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700" },
  metaValue: { color: Colors.text, fontSize: Type.secondary, fontWeight: "800" },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.4)",
    backgroundColor: "rgba(212,167,44,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: Colors.goldLight, fontSize: 10, fontWeight: "800" },
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
    maxHeight: "90%",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 10,
    color: Colors.text,
  },
});
