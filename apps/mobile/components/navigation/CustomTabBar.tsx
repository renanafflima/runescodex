import React from "react";
import { View, Pressable, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Type } from "@/constants/theme";
import { useI18n } from "@/src/i18n";

const TAB_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; labelKey: string }> = {
  index: { icon: "home-outline", iconActive: "home", labelKey: "nav.home" },
  hunts: { icon: "flame-outline", iconActive: "flame", labelKey: "nav.hunts" },
  forum: { icon: "chatbubbles-outline", iconActive: "chatbubbles", labelKey: "nav.forum" },
  shop: { icon: "gift-outline", iconActive: "gift", labelKey: "nav.rewards" },
  profile: { icon: "person-outline", iconActive: "person", labelKey: "nav.profile" },
};

export default function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const visible = state.routes.filter((route) => TAB_META[route.name]);

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {visible.map((route) => {
          const index = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === index;
          const meta = TAB_META[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item}>
              <Ionicons
                name={isFocused ? meta.iconActive : meta.icon}
                size={20}
                color={isFocused ? Colors.goldLight : Colors.textMuted}
              />
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  item: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontSize: Type.tiny,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.goldLight,
  },
});
