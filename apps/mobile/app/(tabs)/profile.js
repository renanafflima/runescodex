import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/src/auth/AuthContext";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import { getProfileFrame } from "@/src/profile/getProfileFrame";

const GOLD = "#d6a84f";
const GOLD2 = "#f0cb76";
const BLUE = "#77a9c8";
const LINE = "rgba(157,180,201,0.20)";
const AVATAR_SIZE = 76;
const FRAME_SIZE = 100;

const backgroundProfile = require("../../assets/profile/background_profile.png");
const heroProfile = require("../../assets/profile/hero_profile.png");

/**
 * Visual catalog only. Unlock state is not stored anywhere in the API.
 * Cards stay locked until a real unlock list exists.
 */
const ACHIEVEMENTS = [
  { id: "primeirospassos", image: require("../../assets/profile/primeirospassos.png") },
  { id: "aventureiro", image: require("../../assets/profile/aventureiro.png") },
  { id: "explorador", image: require("../../assets/profile/explorador.png") },
  { id: "cacador", image: require("../../assets/profile/cacador.png") },
  { id: "mestredascriaturas", image: require("../../assets/profile/mestredascriaturas.png") },
  { id: "erudito", image: require("../../assets/profile/erudito.png") },
  { id: "estrategista", image: require("../../assets/profile/estrategista.png") },
  { id: "forjadordeconhecimento", image: require("../../assets/profile/forjadordeconhecimento.png") },
  { id: "baluartedacomunidade", image: require("../../assets/profile/baluartedacomunidade.png") },
  { id: "veterano", image: require("../../assets/profile/veterano.png") },
  { id: "lendadorunes", image: require("../../assets/profile/lendadorunes.png") },
  { id: "legado", image: require("../../assets/profile/legado.png") },
];

/** Matches prisma enum Vocation. Character.vocation is a string, not the enum, but these are the system options. */
const VOCATIONS = [
  { id: "EK", label: "Knight" },
  { id: "RP", label: "Paladin" },
  { id: "ED", label: "Druid" },
  { id: "MS", label: "Sorcerer" },
];

const EMPTY_FORM = { name: "", vocation: "", level: "", world: "" };

function mapError(error, t) {
  if (error?.code === "NETWORK") return t("auth.networkError");
  if (error?.status === 401) return t("auth.sessionExpired");
  if (error?.status === 400) return t("characters.invalidPayload");
  return t("auth.genericError");
}

function accountName(email) {
  const local = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "—";
  return local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function accountInitial(email) {
  const name = accountName(email);
  return name && name !== "—" ? name.charAt(0).toUpperCase() : "R";
}

function unlockedAchievementIds() {
  // User, Character, and Reward models do not store these 12 profile achievements.
  return [];
}

function vocationLabel(value) {
  const found = VOCATIONS.find((item) => item.id === value || item.label === value);
  return found?.label || value || "—";
}

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const {
    user,
    characters,
    activeCharacter,
    logout,
    createCharacter,
    deleteCharacter,
    setActiveCharacter,
    reloadCharacters,
  } = useAuth();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /**
   * Session-only preview. User has no avatarUrl and the API has no upload endpoint.
   * A future remote URL can replace this by reading user.avatarUrl.
   */
  const [localAvatarUri, setLocalAvatarUri] = useState("");

  useFocusEffect(
    useCallback(() => {
      reloadCharacters();
    }, [reloadCharacters]),
  );

  const columns = width >= 720 ? 3 : 2;
  const cardGap = 10;
  const horizontalPad = Spacing.lg * 2;
  const cardWidth = Math.floor((width - horizontalPad - cardGap * (columns - 1)) / columns);
  const unlockedIds = unlockedAchievementIds();
  const unlockedCount = unlockedIds.length;

  function openCreate() {
    setForm(EMPTY_FORM);
    setError("");
    setFormOpen(true);
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
      await createCharacter({ name, vocation, level, world });
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

  async function pickAvatar(source) {
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setLocalAvatarUri(uri);
    } catch {
      // Picker failure must not break the profile.
    }
  }

  function chooseAvatar() {
    Alert.alert(t("profile.avatarHint"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.avatarGallery"), onPress: () => pickAvatar("library") },
      { text: t("profile.avatarCamera"), onPress: () => pickAvatar("camera") },
    ]);
  }

  const level = activeCharacter?.level;
  const vocation = activeCharacter ? vocationLabel(activeCharacter.vocation) : "";

  return (
    <AppScreen>
      <ImageBackground source={backgroundProfile} resizeMode="cover" style={styles.bg}>
        <LinearGradient
          colors={["rgba(3,10,15,0.55)", "rgba(3,10,15,0.78)", "rgba(3,10,15,0.94)"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={heroProfile} style={styles.heroArt} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(4,9,14,0.15)", "rgba(4,9,14,0.55)", "rgba(4,9,14,0.92)"]}
              style={styles.heroShade}
            />
            <View style={styles.heroContent}>
              <Pressable
                onPress={chooseAvatar}
                accessibilityRole="button"
                accessibilityLabel={t("profile.avatarHint")}
                style={styles.avatarWrap}
              >
                <Image
                  source={getProfileFrame(unlockedCount)}
                  style={styles.avatarFrame}
                  resizeMode="contain"
                />
                {localAvatarUri ? (
                  <Image source={{ uri: localAvatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{accountInitial(user?.email)}</Text>
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera-outline" size={14} color={GOLD2} />
                </View>
              </Pressable>
              <View style={styles.identity}>
                <Text style={styles.eyebrow}>{t("profile.eyebrow")}</Text>
                <Text style={styles.heroName} numberOfLines={2}>
                  {accountName(user?.email)}
                </Text>
                <Text style={styles.heroMeta} numberOfLines={2}>
                  {activeCharacter
                    ? `${vocation} • ${t("profile.adventurerLevel", { level })}`
                    : t("characters.noneActive")}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.journeyTitle")}</Text>
            <View style={styles.panel}>
              <View style={styles.levelRow}>
                <Text style={styles.levelValue}>
                  {level != null ? `${t("profile.levelLabel")} ${level}` : t("characters.noneActive")}
                </Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>{t("profile.xpCurrent")}</Text>
                <Text style={styles.xpValue}>{t("profile.xpUnavailable")}</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>{t("profile.xpNext")}</Text>
                <Text style={styles.xpValue}>{t("profile.xpUnavailable")}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t("profile.achievementsTitle")}</Text>
              <Text style={styles.sectionMeta}>
                {t("profile.achievementsCount", { count: unlockedCount })}
              </Text>
            </View>
            <View style={[styles.grid, { gap: cardGap }]}>
              {ACHIEVEMENTS.map((item) => {
                const unlocked = unlockedIds.includes(item.id);
                return (
                  <View
                    key={item.id}
                    accessibilityLabel={unlocked ? item.id : t("profile.lockedAchievement")}
                    style={[
                      styles.achievement,
                      { width: cardWidth, height: Math.round(cardWidth * 1.35) },
                      unlocked && styles.achievementUnlocked,
                    ]}
                  >
                    {unlocked ? (
                      <Image source={item.image} style={styles.achievementArt} resizeMode="cover" />
                    ) : (
                      <View style={styles.lockWrap}>
                        <Ionicons name="lock-closed" size={22} color="rgba(157,180,201,0.55)" />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.charactersTitle")}</Text>
            {(characters || []).length === 0 ? (
              <Text style={styles.empty}>{t("characters.empty")}</Text>
            ) : (
              characters.map((item) => {
                const isActive = activeCharacter?.id === item.id;
                return (
                  <View key={item.id} style={[styles.characterRow, isActive && styles.characterActive]}>
                    <View style={styles.characterCopy}>
                      <Text style={styles.characterName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.characterMeta} numberOfLines={1}>
                        {t("characters.level")} {item.level} • {vocationLabel(item.vocation)}
                      </Text>
                    </View>
                    {isActive ? (
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeText}>{t("characters.active")}</Text>
                      </View>
                    ) : (
                      <Pressable onPress={() => activate(item)} style={styles.activateBtn}>
                        <Text style={styles.activateText}>{t("characters.setActive")}</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      hitSlop={8}
                      accessibilityLabel={t("characters.delete")}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })
            )}
            <Pressable onPress={openCreate} style={styles.addRow}>
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addLabel}>{t("profile.addCharacter")}</Text>
            </Pressable>
          </View>

          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>{t("auth.logout")}</Text>
          </Pressable>
        </ScrollView>
      </ImageBackground>

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.sectionTitle}>{t("profile.addCharacter")}</Text>
            <Field
              label={t("characters.name")}
              value={form.name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <Field
              label={t("characters.level")}
              value={form.level}
              onChangeText={(value) => setForm((prev) => ({ ...prev, level: value.replace(/[^0-9]/g, "") }))}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLabel}>{t("characters.vocation")}</Text>
            <View style={styles.vocationRow}>
              {VOCATIONS.map((item) => {
                const selected = form.vocation === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setForm((prev) => ({ ...prev, vocation: item.id }))}
                    style={[styles.vocationChip, selected && styles.vocationChipOn]}
                  >
                    <Text style={[styles.vocationText, selected && styles.vocationTextOn]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label={t("characters.world")}
              value={form.world}
              onChangeText={(value) => setForm((prev) => ({ ...prev, world: value }))}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={submitCharacter} disabled={busy} style={styles.saveBtn}>
              <Text style={styles.saveText}>{busy ? t("common.loading") : t("common.save")}</Text>
            </Pressable>
            <Pressable onPress={() => setFormOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t("common.close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { padding: Spacing.lg, gap: 18, paddingBottom: 36 },
  hero: {
    minHeight: 220,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LINE,
  },
  heroArt: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    flex: 1,
    minHeight: 220,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    padding: 18,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarFrame: {
    position: "absolute",
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    zIndex: 0,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: GOLD,
    zIndex: 1,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: "#10202c",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  avatarLetter: { color: GOLD2, fontSize: 28, fontWeight: "700" },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b141d",
    borderWidth: 1,
    borderColor: GOLD,
    zIndex: 2,
  },
  identity: { flex: 1, minWidth: 0, paddingBottom: 2 },
  eyebrow: {
    color: GOLD2,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroName: { color: Colors.text, fontSize: 26, fontWeight: "700", marginTop: 4 },
  heroMeta: { color: BLUE, fontSize: Type.body, marginTop: 4 },
  section: { gap: 12 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: "700", flexShrink: 1 },
  sectionMeta: { color: Colors.textMuted, fontSize: Type.secondary },
  panel: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    backgroundColor: "rgba(4,9,14,0.55)",
    padding: 16,
    gap: 10,
  },
  levelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelValue: { color: GOLD2, fontSize: 18, fontWeight: "700" },
  xpRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  xpLabel: { color: Colors.textMuted, fontSize: Type.secondary },
  xpValue: { color: Colors.textSecondary, fontSize: Type.secondary, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  achievement: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#04080c",
  },
  achievementUnlocked: { borderColor: "rgba(214,168,79,0.45)" },
  achievementArt: { width: "100%", height: "100%" },
  lockWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: Colors.textSecondary, fontSize: Type.secondary },
  characterRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "rgba(4,9,14,0.52)",
  },
  characterActive: {
    borderColor: "rgba(72,190,112,0.62)",
    borderLeftWidth: 3,
    borderLeftColor: "#48be70",
  },
  characterCopy: { flex: 1, minWidth: 0, gap: 3 },
  characterName: { color: "#f1e4c2", fontSize: 16, fontWeight: "700" },
  characterMeta: { color: "#86a0b5", fontSize: 12 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(72,190,112,0.48)",
    backgroundColor: "rgba(72,190,112,0.10)",
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#48be70" },
  activeText: {
    color: "#63d687",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  activateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(214,168,79,0.42)",
    backgroundColor: "rgba(214,168,79,0.07)",
  },
  activateText: {
    color: GOLD2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  addRow: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(119,169,200,0.32)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(4,9,14,0.30)",
  },
  addPlus: { color: GOLD2, fontSize: 18, fontWeight: "700" },
  addLabel: { color: "#9db3c4", fontSize: 13 },
  logout: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  logoutText: { color: Colors.textMuted, fontSize: Type.secondary, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: "#0d1822",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    gap: 10,
  },
  field: { gap: 6 },
  fieldLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#071018",
    borderRadius: Radius.md,
    padding: 10,
    color: Colors.text,
  },
  vocationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vocationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "rgba(4,9,14,0.5)",
  },
  vocationChipOn: {
    borderColor: "rgba(214,168,79,0.55)",
    backgroundColor: "rgba(214,168,79,0.14)",
  },
  vocationText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },
  vocationTextOn: { color: GOLD2 },
  error: { color: Colors.danger, fontSize: Type.secondary },
  saveBtn: {
    minHeight: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(214,168,79,0.18)",
    borderWidth: 1,
    borderColor: "rgba(214,168,79,0.55)",
  },
  saveText: { color: GOLD2, fontWeight: "800" },
  cancelBtn: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { color: Colors.textSecondary, fontWeight: "700" },
});
