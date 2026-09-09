import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { useI18n } from "@/src/i18n";
import { Colors, Radius, Spacing, Type } from "@/constants/theme";
import AppScreen from "@/components/ui/AppScreen";
import AppCard from "@/components/ui/AppCard";

const coverPlaceholder = require("@/assets/ui/music.png");

export default function MusicDisplay() {
  const { t } = useI18n();
  const player = useAudioPlayer(undefined, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch (error) {
        console.log("Erro ao configurar áudio:", error);
      }
    };
    configureAudio();
  }, []);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  const isPlaying = status?.playing ?? false;
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const isLoaded = status?.isLoaded ?? false;

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(currentTime / duration, 1);
  }, [currentTime, duration]);

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const min = Math.floor(safe / 60);
    const sec = safe % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!isLoaded) return;
    if (isPlaying) player.pause();
    else player.play();
  };

  const handleRestart = async () => {
    if (!isLoaded) return;
    await player.seekTo(0);
    player.play();
  };

  const handleBack10 = async () => {
    if (!isLoaded) return;
    await player.seekTo(Math.max(currentTime - 10, 0));
  };

  const handleForward10 = async () => {
    if (!isLoaded) return;
    await player.seekTo(Math.min(currentTime + 10, duration || currentTime + 10));
  };

  return (
    <AppScreen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("music.title")}</Text>
        <Text style={styles.subtitle}>{t("music.subtitle")}</Text>

        <AppCard>
          <View style={styles.topRow}>
            <Image source={coverPlaceholder} style={styles.cover} />
            <View style={{ flex: 1 }}>
              <Text style={styles.track}>{t("music.track")}</Text>
              <Text style={styles.artist}>{t("music.artist")}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{isPlaying ? t("music.playing") : t("music.paused")}</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(currentTime)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable style={styles.secBtn} onPress={handleBack10}>
              <Text style={styles.secText}>-10s</Text>
            </Pressable>
            <Pressable style={styles.mainBtn} onPress={handlePlayPause}>
              <Text style={styles.mainText}>{isPlaying ? t("music.pause") : t("music.play")}</Text>
            </Pressable>
            <Pressable style={styles.secBtn} onPress={handleForward10}>
              <Text style={styles.secText}>+10s</Text>
            </Pressable>
          </View>

          <View style={styles.bottom}>
            <Pressable style={styles.secBtn} onPress={handleRestart}>
              <Text style={styles.secText}>{t("music.restart")}</Text>
            </Pressable>
            <View style={styles.volBox}>
              <Pressable onPress={() => setVolume((v) => Math.max(Number((v - 0.1).toFixed(1)), 0))}>
                <Text style={styles.secText}>-</Text>
              </Pressable>
              <Text style={styles.time}>
                {t("music.vol")} {Math.round(volume * 100)}%
              </Text>
              <Pressable onPress={() => setVolume((v) => Math.min(Number((v + 0.1).toFixed(1)), 1))}>
                <Text style={styles.secText}>+</Text>
              </Pressable>
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.lg, gap: 12 },
  title: { color: Colors.text, fontSize: Type.screen, fontWeight: "800" },
  subtitle: { color: Colors.textSecondary, fontSize: Type.secondary },
  topRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  cover: { width: 76, height: 76, borderRadius: Radius.md, backgroundColor: Colors.bgSecondary },
  track: { color: Colors.text, fontSize: Type.card, fontWeight: "800" },
  artist: { color: Colors.textSecondary, marginTop: 4, fontSize: Type.secondary },
  badge: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    backgroundColor: "rgba(59,130,246,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: Colors.text, fontSize: 10, fontWeight: "800" },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgSecondary,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.gold },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  time: { color: Colors.textSecondary, fontSize: Type.tiny, fontWeight: "700" },
  controls: { flexDirection: "row", gap: 8 },
  mainBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    backgroundColor: "rgba(212,167,44,0.16)",
    borderWidth: 1,
    borderColor: "rgba(212,167,44,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainText: { color: Colors.goldLight, fontWeight: "800" },
  secBtn: {
    minHeight: 44,
    minWidth: 70,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secText: { color: Colors.text, fontWeight: "700" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  volBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
