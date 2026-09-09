import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";

export default function AppCard({ children, style, elevated }) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 10,
    ...Shadow.card,
  },
  elevated: {
    backgroundColor: Colors.cardElevated,
  },
});
