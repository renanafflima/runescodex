import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useAppStore } from "../../src/store/AppStore";
import { useI18n } from "@/src/i18n";
import { Colors as COLORS } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";

const TYPES = ["Hunt", "Streamer", "Serviceiro", "Suggestion", "Quest", "Items", "Other"];
const STATUS = ["all", "open", "resolved"];
const SORTS = ["Newest", "Oldest"];

// ✅ Background da tela Quest Board
// Coloque em: apps/mobile/assets/ui/questboard-bg.png
const questBoardBg = require("@/assets/ui/questboard.png");

export default function QuestBoardScreen() {
  const { t } = useI18n();
  const { userId, points, quests, actions } = useAppStore();

  const [composerOpen, setComposerOpen] = useState(false);
  const [type, setType] = useState("Hunt");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState("");

  // Somente campos que permanecem no formulário
  const [fields, setFields] = useState({
    // Hunt
    spawn: "",
    location: "",
    level: "",
    vocation: "",
    xpH: "",
    profitH: "",
    setUsed: "",
    runes: "",
    charms: "",

    // Genérico / demais tipos
    details: "",
    links: "",
  });

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");

  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.06],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.32],
  });

  const data = useMemo(() => {
    const query = q.trim().toLowerCase();

    let arr = (quests || []).filter((it) => {
      const t = normalizeType(it?.type);

      const matchQ =
        !query ||
        String(it?.title ?? "").toLowerCase().includes(query) ||
        String(it?.description ?? "").toLowerCase().includes(query) ||
        String(it?.createdByUserId ?? "").toLowerCase().includes(query);

      const matchStatus = status === "all" ? true : String(it?.status) === status;
      const matchType = typeFilter === "All" ? true : t === typeFilter;

      return matchQ && matchStatus && matchType;
    });

    arr = [...arr].sort((a, b) => {
      const da = toDateMs(a?.createdAt);
      const db = toDateMs(b?.createdAt);
      if (da !== db) return sortBy === "Newest" ? db - da : da - db;
      return String(b?.id ?? "").localeCompare(String(a?.id ?? ""));
    });

    return arr;
  }, [quests, q, status, typeFilter, sortBy]);

  const openCount = useMemo(
    () => (quests || []).filter((t) => t?.status === "open").length,
    [quests]
  );

  const resolvedCount = useMemo(
    () => (quests || []).filter((t) => t?.status === "resolved").length,
    [quests]
  );

  const requiredCommonOk = !!title.trim() && !!description.trim();

  const requiredByTypeOk = useMemo(() => {
    if (!requiredCommonOk) return false;

    if (type === "Hunt") {
      return (
        !!fields.spawn.trim() &&
        !!fields.level.trim() &&
        !!fields.vocation.trim() &&
        !!photoUri
      );
    }

    if (type === "Suggestion") {
      return !!fields.details.trim();
    }

    return true;
  }, [requiredCommonOk, type, fields, photoUri]);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();

    if (perm.status !== "granted") {
      Alert.alert(
        t("tickets.photoNeeded"),
        t("tickets.photoMsg")
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });

    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (uri) setPhotoUri(uri);
  }

  function resetComposer() {
    setTitle("");
    setDescription("");
    setType("Hunt");
    setPhotoUri("");
    setFields({
      spawn: "",
      location: "",
      level: "",
      vocation: "",
      xpH: "",
      profitH: "",
      setUsed: "",
      runes: "",
      charms: "",
      details: "",
      links: "",
    });
    setComposerOpen(false);
  }

  function submitTicket() {
    if (!requiredByTypeOk) return;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      type,
      photoUri: photoUri || undefined,
      meta: buildMeta(type, fields),
    };

    actions.createQuest(payload);
    resetComposer();
  }

  return (
    <AppScreen>
      <ImageBackground source={questBoardBg} resizeMode="cover" style={styles.bg}>
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

        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <View style={styles.header}>
                <Text style={styles.title}>{t("tickets.title")}</Text>
                <Text style={styles.subtitle}>{t("tickets.subtitle")}</Text>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{data.length} resultados</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Abertos: {openCount}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Resolvidos: {resolvedCount}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Pontos: {points}</Text>
                  </View>
                </View>

                <Text style={{ color: COLORS.muted, marginTop: 8, fontWeight: "800", fontSize: 12 }}>
                  Seu ID: {userId}
                </Text>

                <Animated.View
                  pointerEvents="none"
                  style={[styles.glowOrb, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(109,120,225,0.0)",
                      "rgba(109,120,225,0.55)",
                      "rgba(217,146,84,0.35)",
                    ]}
                    start={{ x: 0.2, y: 0.2 }}
                    end={{ x: 0.8, y: 0.9 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>

              <View style={styles.searchRow}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t("tickets.search")}
                  placeholderTextColor="rgba(231,231,221,0.55)"
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
                    <Text style={styles.clearText}>✕</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.topActionsRow}>
                <Pressable
                  onPress={() => setComposerOpen((s) => !s)}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.pressed,
                    composerOpen && styles.primaryBtnOn,
                  ]}
                >
                  <LinearGradient
                    colors={["rgba(217,146,84,0.22)", "rgba(43,58,184,0.18)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.primaryBtnText}>
                    {composerOpen ? "Fechar abertura" : "Abrir chamado"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setQ("");
                    setStatus("all");
                    setTypeFilter("All");
                    setSortBy("Newest");
                  }}
                  style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.ghostBtnText}>Limpar filtros</Text>
                </Pressable>
              </View>

              {composerOpen && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>Abrir chamado</Text>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Tipo: {type}</Text>
                    </View>
                  </View>

                  <Text style={styles.filterLabel}>Tipo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diffRow}>
                    {TYPES.map((t) => (
                      <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
                    ))}
                  </ScrollView>

                  <Text style={styles.filterLabel}>Título</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ex: Hunt nova / Streamer em destaque / Serviceiro..."
                    placeholderTextColor="rgba(231,231,221,0.55)"
                    style={styles.input}
                  />

                  <Text style={styles.filterLabel}>Descrição</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Explique o pedido com detalhes"
                    placeholderTextColor="rgba(231,231,221,0.55)"
                    multiline
                    style={[styles.input, { height: 110, textAlignVertical: "top" }]}
                  />

                  <View style={styles.infoBlock}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.infoTitle}>Foto do chamado{type === "Hunt" ? " *" : ""}</Text>
                      {!!photoUri && (
                        <Pressable
                          onPress={() => setPhotoUri("")}
                          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
                        >
                          <Text style={styles.clearText}>🗑</Text>
                        </Pressable>
                      )}
                    </View>

                    {!!photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <Text style={{ color: COLORS.muted, fontWeight: "900" }}>
                          Nenhuma foto ainda
                        </Text>
                      </View>
                    )}

                    <Pressable
                      onPress={takePhoto}
                      style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.sendText}>
                        {photoUri ? "Tirar outra foto" : "Abrir câmera"}
                      </Text>
                    </Pressable>

                    <Text style={{ color: COLORS.muted, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                      {type === "Hunt"
                        ? "Obrigatório: para Hunt, a foto é necessária."
                        : "Opcional: você pode anexar uma foto para ajudar no atendimento."}
                    </Text>
                  </View>

                  {type === "Hunt" && (
                    <View style={styles.infoBlock}>
                      <Text style={styles.infoTitle}>Campos — Hunt *</Text>

                      <Text style={styles.filterLabel}>Spawn *</Text>
                      <TextInput
                        value={fields.spawn}
                        onChangeText={(t) => setFields((p) => ({ ...p, spawn: t }))}
                        placeholder="Ex: Asura Palace"
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />

                      <Text style={styles.filterLabel}>Localização</Text>
                      <TextInput
                        value={fields.location}
                        onChangeText={(t) => setFields((p) => ({ ...p, location: t }))}
                        placeholder="Ex: Port Hope / Darashia..."
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />

                      <View style={styles.infoBlockRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterLabel}>Level *</Text>
                          <TextInput
                            value={fields.level}
                            onChangeText={(t) => setFields((p) => ({ ...p, level: t }))}
                            placeholder="Ex: 120"
                            keyboardType="numeric"
                            placeholderTextColor="rgba(231,231,221,0.55)"
                            style={styles.input}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterLabel}>Vocation *</Text>
                          <TextInput
                            value={fields.vocation}
                            onChangeText={(t) => setFields((p) => ({ ...p, vocation: t }))}
                            placeholder="Ex: EK / RP / MS / ED"
                            placeholderTextColor="rgba(231,231,221,0.55)"
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <View style={styles.infoBlockRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterLabel}>XP/h</Text>
                          <TextInput
                            value={fields.xpH}
                            onChangeText={(t) => setFields((p) => ({ ...p, xpH: t }))}
                            placeholder="Ex: 900k"
                            placeholderTextColor="rgba(231,231,221,0.55)"
                            style={styles.input}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.filterLabel}>Profit/h</Text>
                          <TextInput
                            value={fields.profitH}
                            onChangeText={(t) => setFields((p) => ({ ...p, profitH: t }))}
                            placeholder="Ex: 120k"
                            placeholderTextColor="rgba(231,231,221,0.55)"
                            style={styles.input}
                          />
                        </View>
                      </View>

                      <Text style={styles.filterLabel}>Set usado</Text>
                      <TextInput
                        value={fields.setUsed}
                        onChangeText={(t) => setFields((p) => ({ ...p, setUsed: t }))}
                        placeholder="Ex: set principal"
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />

                      <Text style={styles.filterLabel}>Runas/Spells</Text>
                      <TextInput
                        value={fields.runes}
                        onChangeText={(t) => setFields((p) => ({ ...p, runes: t }))}
                        placeholder="Ex: avalanche, gfb, mas san..."
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />

                      <Text style={styles.filterLabel}>Charms</Text>
                      <TextInput
                        value={fields.charms}
                        onChangeText={(t) => setFields((p) => ({ ...p, charms: t }))}
                        placeholder="Ex: Freeze / Zap..."
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />
                    </View>
                  )}

                  {(type === "Streamer" ||
                    type === "Serviceiro" ||
                    type === "Suggestion" ||
                    type === "Quest" ||
                    type === "Items" ||
                    type === "Other") && (
                    <View style={styles.infoBlock}>
                      <Text style={styles.infoTitle}>
                        Campos — {type}{type === "Suggestion" ? " *" : ""}
                      </Text>

                      <Text style={styles.filterLabel}>
                        Detalhes{type === "Suggestion" ? " *" : ""}
                      </Text>
                      <TextInput
                        value={fields.details}
                        onChangeText={(t) => setFields((p) => ({ ...p, details: t }))}
                        placeholder="Descreva o que você precisa"
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        multiline
                        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                      />

                      <Text style={styles.filterLabel}>Links/referências</Text>
                      <TextInput
                        value={fields.links}
                        onChangeText={(t) => setFields((p) => ({ ...p, links: t }))}
                        placeholder="Ex: vídeo, perfil, print, referência..."
                        placeholderTextColor="rgba(231,231,221,0.55)"
                        style={styles.input}
                      />
                    </View>
                  )}

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={submitTicket}
                      disabled={!requiredByTypeOk}
                      style={({ pressed }) => [
                        styles.publishBtn,
                        (pressed || !requiredByTypeOk) && styles.pressed,
                        !requiredByTypeOk && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={styles.publishText}>Enviar chamado</Text>
                    </Pressable>

                    <Pressable
                      onPress={resetComposer}
                      style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </Pressable>
                  </View>

                  {!requiredByTypeOk && (
                    <Text style={{ color: COLORS.gold, fontWeight: "900", fontSize: 12 }}>
                      Preencha os campos obrigatórios{type === "Hunt" ? " (incluindo foto)" : ""}.
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.card}>
                <Pressable
                  onPress={() => setFiltersOpen((s) => !s)}
                  style={({ pressed }) => [styles.rowBetween, pressed && styles.pressed]}
                >
                  <Text style={styles.cardTitle}>Filtros</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {filtersOpen ? "Minimizar ▲" : "Expandir ▼"}
                    </Text>
                  </View>
                </Pressable>

                {filtersOpen && (
                  <>
                    <Text style={styles.filterLabel}>Tipo</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diffRow}>
                      {["All", ...TYPES].map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          active={typeFilter === t}
                          onPress={() => setTypeFilter(t)}
                        />
                      ))}
                    </ScrollView>

                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.chipsRow}>
                      {STATUS.map((s) => (
                        <Chip
                          key={s}
                          label={s === "all" ? "Todos" : s === "open" ? "Abertos" : "Resolvidos"}
                          active={status === s}
                          onPress={() => setStatus(s)}
                        />
                      ))}
                    </View>

                    <Text style={styles.filterLabel}>Ordenar</Text>
                    <View style={styles.chipsRow}>
                      {SORTS.map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          active={sortBy === s}
                          onPress={() => setSortBy(s)}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => <QuestCard item={item} actions={actions} />}
          ListEmptyComponent={
            <Text style={{ color: COLORS.muted, marginTop: 12, paddingHorizontal: 16 }}>
              {t("tickets.empty")}
            </Text>
          }
        />
      </ImageBackground>
    </AppScreen>
  );
}

function QuestCard({ item, actions }) {
  const { t } = useI18n();
  const status = String(item?.status ?? "open");
  const isOpen = status === "open";
  const type = normalizeType(item?.type);

  return (
    <View style={[styles.card, styles.questCard]}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.threadTitle} numberOfLines={2}>
            {String(item?.title ?? "")}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: "rgba(109,120,225,0.12)",
                  borderColor: "rgba(109,120,225,0.32)",
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: COLORS.text }]}>{type}</Text>
            </View>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isOpen ? "rgba(217,146,84,0.12)" : "rgba(109,120,225,0.10)",
                  borderColor: isOpen ? "rgba(217,146,84,0.45)" : COLORS.border,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: isOpen ? COLORS.gold : COLORS.text }]}>
                {isOpen ? "OPEN" : "RESOLVED"}
              </Text>
            </View>

            <View style={styles.badgeSoft}>
              <Text style={styles.badgeSoftText}>+{Number(item?.rewardPoints ?? 0)} pts</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>Descrição</Text>
        <Text style={styles.infoText}>{String(item?.description ?? "")}</Text>
      </View>

      {!!item?.photoUri && (
        <View style={styles.infoBlock}>
          <Text style={styles.infoTitle}>Foto</Text>
          <Image source={{ uri: String(item.photoUri) }} style={styles.photoPreview} />
        </View>
      )}

      <View style={styles.infoBlockRow}>
        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>Autor</Text>
          <Text style={styles.infoText}>{String(item?.createdByUserId ?? "—")}</Text>
        </View>

        <View style={[styles.infoBlock, { flex: 1 }]}>
          <Text style={styles.infoTitle}>Criado em</Text>
          <Text style={styles.infoText}>{formatMaybeDate(item?.createdAt)}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => {
          if (!isOpen) return;

          Alert.alert(
            t("tickets.resolveTitle"),
            t("tickets.resolveMsg", { points: item?.rewardPoints ?? 0 }),
            [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("common.resolved"), onPress: () => actions.resolveQuest(item.id) },
            ]
          );
        }}
        disabled={!isOpen}
        style={({ pressed }) => [
          styles.closeBtn,
          pressed && styles.pressed,
          !isOpen && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.closeText}>{t("tickets.resolve")}</Text>
      </Pressable>
    </View>
  );
}

function buildMeta(type, f) {
  if (type === "Hunt") {
    return {
      spawn: f.spawn?.trim(),
      location: f.location?.trim(),
      level: f.level?.trim(),
      vocation: f.vocation?.trim(),
      xpH: f.xpH?.trim(),
      profitH: f.profitH?.trim(),
      setUsed: f.setUsed?.trim(),
      runes: f.runes?.trim(),
      charms: f.charms?.trim(),
    };
  }

  return {
    details: f.details?.trim(),
    links: f.links?.trim(),
  };
}

function normalizeType(value) {
  const v = String(value ?? "").trim().toLowerCase();

  const map = {
    hunt: "Hunt",
    streamer: "Streamer",
    serviceiro: "Serviceiro",
    suggestion: "Suggestion",
    suggestions: "Suggestion",
    quest: "Quest",
    quests: "Quest",
    item: "Items",
    items: "Items",
    other: "Other",
  };

  return map[v] ?? "Other";
}

function toDateMs(v) {
  if (!v) return 0;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatMaybeDate(v) {
  const ms = toDateMs(v);
  if (!ms) return "—";

  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
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
    position: "relative",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(15, 12, 35, 0.50)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  glowOrb: {
    position: "absolute",
    right: -40,
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 999,
  },

  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },

  subtitle: {
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 18,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  searchIcon: {
    color: COLORS.muted,
    fontSize: 16,
  },

  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
  },

  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.28)",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },

  clearText: {
    color: COLORS.muted,
    fontWeight: "900",
  },

  topActionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(217,146,84,0.45)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },

  primaryBtnOn: {
    borderColor: "rgba(109,120,225,0.40)",
  },

  primaryBtnText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
    alignItems: "center",
    justifyContent: "center",
  },

  ghostBtnText: {
    color: COLORS.muted,
    fontWeight: "900",
  },

  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
    }),
  },

  questCard: {
    marginHorizontal: 16,
    backgroundColor: "rgba(15, 12, 35, 0.68)",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(109,120,225,0.10)",
  },

  pillText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },

  filterLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 2,
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  diffRow: {
    gap: 8,
    paddingRight: 6,
  },

  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
    backgroundColor: "rgba(9, 7, 30, 0.35)",
  },

  chipActive: {
    borderColor: "rgba(217,146,84,0.45)",
  },

  chipText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },

  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },

  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontWeight: "800",
  },

  publishBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(217,146,84,0.45)",
    backgroundColor: "rgba(217,146,84,0.14)",
  },

  publishText: {
    color: COLORS.gold,
    fontWeight: "900",
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.30)",
  },

  cancelText: {
    color: COLORS.muted,
    fontWeight: "900",
  },

  threadTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },

  badgeText: {
    fontWeight: "900",
    fontSize: 12,
  },

  badgeSoft: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.25)",
  },

  badgeSoftText: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },

  infoBlock: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
    gap: 10,
  },

  infoBlockRow: {
    flexDirection: "row",
    gap: 10,
  },

  infoTitle: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },

  infoText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 18,
  },

  closeBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.26)",
    backgroundColor: "rgba(9, 7, 30, 0.28)",
  },

  closeText: {
    color: COLORS.text,
    fontWeight: "900",
  },

  sendBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(217,146,84,0.45)",
    backgroundColor: "rgba(217,146,84,0.12)",
  },

  sendText: {
    color: COLORS.gold,
    fontWeight: "900",
  },

  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.25)",
  },

  photoEmpty: {
    width: "100%",
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(109,120,225,0.22)",
    backgroundColor: "rgba(9, 7, 30, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});