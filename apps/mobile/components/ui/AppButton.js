import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Colors, Radius, Type } from "@/constants/theme";

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, variant === "ghost" && styles.ghostText, variant === "secondary" && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: "rgba(212,167,44,0.16)",
    borderColor: "rgba(212,167,44,0.45)",
  },
  secondary: {
    backgroundColor: "rgba(59,130,246,0.14)",
    borderColor: "rgba(59,130,246,0.35)",
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: "rgba(239,68,68,0.4)",
  },
  text: {
    color: Colors.goldLight,
    fontWeight: "800",
    fontSize: Type.body,
  },
  ghostText: {
    color: Colors.text,
  },
  secondaryText: {
    color: Colors.text,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});
