import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, Type } from "@/constants/theme";
import AppButton from "./AppButton";

export default function EmptyState({ title, hint, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: "center",
  },
  title: {
    color: Colors.text,
    fontSize: Type.card,
    fontWeight: "800",
    textAlign: "center",
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: Type.secondary,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
});
