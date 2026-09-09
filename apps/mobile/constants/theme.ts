import { Platform } from "react-native";

export const Colors = {
  bg: "#070B14",
  bgSecondary: "#0D1322",
  card: "#111827",
  cardElevated: "#151E30",
  border: "#26334A",
  gold: "#D4A72C",
  goldLight: "#F0C75E",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  danger: "#EF4444",
  success: "#22C55E",

  // aliases used by existing screens
  bg0: "#070B14",
  bg1: "#0D1322",
  bg2: "#151E30",
  muted: "#94A3B8",
  accentBlue: "#3B82F6",
  accentBlue2: "#8B5CF6",
  specialText: "#C4B5FD",
  specialBorder: "rgba(139,92,246,0.42)",
  specialCard: "rgba(45, 16, 55, 0.52)",
  specialFill: "rgba(192,123,255,0.70)",
};

export const Spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
};

export const Type = {
  screen: 24,
  section: 17,
  card: 15,
  body: 14,
  secondary: 12,
  tiny: 11,
};

export const Shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 3 },
    default: {},
  }),
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
