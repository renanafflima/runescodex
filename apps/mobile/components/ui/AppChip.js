import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Colors, Radius, Type } from "@/constants/theme";

export default function AppChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.active,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  active: {
    borderColor: "rgba(212,167,44,0.5)",
    backgroundColor: "rgba(212,167,44,0.14)",
  },
  text: {
    color: Colors.textSecondary,
    fontSize: Type.secondary,
    fontWeight: "700",
  },
  activeText: {
    color: Colors.goldLight,
  },
});
