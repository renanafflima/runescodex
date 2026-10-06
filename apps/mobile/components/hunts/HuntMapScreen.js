import React from "react";
import { Image, ImageBackground, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Spacing } from "@/constants/theme";
import { huntsBackground } from "@/src/data/hunts";
import { useI18n } from "@/src/i18n";

export default function HuntMapScreen({ visible, title, source, onClose }) {
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <ImageBackground source={huntsBackground} resizeMode="cover" style={styles.screen}>
        <LinearGradient
          colors={["rgba(7,11,20,0.78)", "rgba(7,11,20,0.96)"]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Ionicons name="chevron-back" size={23} color={Colors.text} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{t("hunts.mapKicker")}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>

          <View style={styles.mapStage}>
            {source ? (
              <Image source={source} style={styles.map} resizeMode="contain" />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>{t("hunts.mapMissing")}</Text>
              </View>
            )}
          </View>
          <View style={styles.footer}>
            <Ionicons name="location-outline" size={16} color={Colors.goldLight} />
            <Text style={styles.footerText}>{t("hunts.mapHint")}</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,167,44,0.24)",
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  kicker: {
    color: Colors.goldLight,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: "800", marginTop: 2 },
  mapStage: { flex: 1, padding: Spacing.md, alignItems: "center", justifyContent: "center" },
  map: { width: "100%", height: "100%" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 13 },
  footer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148,163,184,0.16)",
  },
  footerText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
});
