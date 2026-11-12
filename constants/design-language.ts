import { Platform, type ViewStyle } from "react-native";

/** Semantic version — bump when breaking visual contracts. */
export const DESIGN_LANGUAGE_VERSION = "1.0.0";

export const DESIGN_LANGUAGE_NAME = "Unmask Lively Glass";

/** Page-level gradient sets (expo-linear-gradient). */
export const livelyGradients = {
  page: ["#F8F4F0", "#FDFAF7", "#F2E8ED"] as const,
  social: ["#EEF6FC", "#FBFAF8", "#F6ECEF"] as const,
  cinema: ["#1A0A0E", "#2D1219", "#F8F4F0"] as const,
  action: ["#3D0F15", "#5C2834", "#70323E"] as const,
  actionPressed: ["#2A0A10", "#3D0F15", "#5C2834"] as const,
  goldAccent: ["#FFF8E8", "#F7EED4", "#F2DEAA"] as const,
  skyWash: ["#E8F4FC", "#F5FAFE"] as const,
} as const;

export type LivelyGradientKey = keyof typeof livelyGradients;

export const glass = {
  fill: "rgba(255, 255, 255, 0.76)",
  fillStrong: "rgba(255, 255, 255, 0.9)",
  fillDark: "rgba(11, 9, 9, 0.45)",
  stroke: "rgba(255, 255, 255, 0.65)",
  strokeMuted: "rgba(232, 226, 223, 0.95)",
  /** Web `backdrop-filter` strength in px — applied in GlassCard on web only. */
  blurPx: 20,
} as const;

export const livelyRadii = {
  card: 26,
  hero: 32,
  button: 20,
  dock: 28,
  story: 22,
  chip: 999,
  input: 18,
} as const;

export const livelySpace = {
  pageX: 20,
  section: 22,
  cardPad: 18,
  dockInset: 14,
} as const;

export const livelyElevation = Platform.select({
  web: {
    card: {
      boxShadow:
        "0 2px 8px rgba(28,25,23,0.04), 0 12px 40px rgba(61,15,21,0.09)",
    } as ViewStyle,
    dock: {
      boxShadow:
        "0 8px 28px rgba(61,15,21,0.14), 0 2px 6px rgba(28,25,23,0.06)",
    } as ViewStyle,
    fab: {
      boxShadow: "0 10px 32px rgba(61,15,21,0.28)",
    } as ViewStyle,
  },
  default: {
    card: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.09,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    } as ViewStyle,
    dock: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    } as ViewStyle,
    fab: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.32,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    } as ViewStyle,
  },
}) as Record<"card" | "dock" | "fab", ViewStyle>;
