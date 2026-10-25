import { Platform, type ViewStyle } from "react-native";

import { BRAND_COPY } from "./brand";

/**
 * Unmask visual system — white reading surface, wine actions, gold Sparks.
 * Spec ch.03 / ch.08. Craft: Apple hierarchy, Airbnb photography, creator energy.
 */
export const colors = {
  wine: "#FFFFFF",
  wineDeep: "#F6F3F1",
  lac: "#FFFFFF",
  lac2: "#F6F0F2",
  redact: "#1C1917",
  bone: "#1C1917",
  bone2: "#5C534F",
  bone3: "#746B66",
  line: "#E8E2DF",
  sage: "#236044",
  honey: "#7A4B00",
  coral: "#A52323",
  brand: "#70323E",
  brandDeep: "#3D0F15",
  gold: "#C9A227",
  goldSoft: "#F7EED4",
  headerBg: "#FFFFFF",
  hi: "#3D0F15",
  hiSoft: "#F4EBED",
  hiInk: "#3D0F15",
  stage: "#F6F3F1",
  shell: "#FFFFFF",
  ink: "#1C1917",
  inkSoft: "#5C534F",
  rosewood: "#70323E",
  rosewoodSoft: "#F4EBED",
  honeySoft: "#FFF6E8",
  honeyInk: "#7A4B00",
  honeyBadge: "#7A4B00",
  sageSoft: "#E8F3ED",
  sageInk: "#236044",
  coralSoft: "#FBEAEA",
  mist: "#F3F0EE",
  white: "#FFFFFF",
  black: "#1C1917",
  webShell: "#E8E2DF",
  mark: "#F5E9C8",
  markInk: "#1C1917",
  markDark: "#70323E",
  markGood: "#D8EDE3",
  markGoodInk: "#236044",
  markBad: "#F5DEDE",
  markBadInk: "#A52323",
  marker: "#C9A227",
  markerInk: "#1C1917",
  markerConcern: "#C45C4A",
} as const;

export const radii = {
  card: 22,
  button: 16,
  photo: 20,
  chip: 999,
  notice: 14,
  thumb: 14,
  search: 14,
  ib: 14,
  sheet: 28,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  sec: 48,
} as const;

export const type = {
  wordmark: 22,
  hero: 34,
  hLg: 22,
  hMd: 20,
  hSm: 16,
  body: 16,
  caption: 14,
  eyebrow: 12,
  button: 16,
  chip: 14,
  badge: 12,
  score: 36,
} as const;

export const motion = {
  press: 80,
  release: 120,
  selection: 160,
  reveal: 220,
  sheet: 280,
  signature: 400,
  ease: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const elevation = Platform.select({
  web: {
    flat: {},
    raised: {
      boxShadow:
        "0 1px 2px rgba(28,25,23,0.04), 0 10px 28px rgba(61,15,21,0.08)",
    },
    lifted: { boxShadow: "0 18px 50px rgba(61,15,21,0.16)" },
    fab: { boxShadow: "0 8px 24px rgba(61,15,21,0.32)" },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    lifted: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.18,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
    fab: {
      shadowColor: "#3D0F15",
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  },
}) as Record<"flat" | "raised" | "lifted" | "fab", ViewStyle>;

export const scrim = {
  soft: "rgba(28,25,23,0.18)",
  strong: "rgba(28,25,23,0.55)",
  onLight: "rgba(255,255,255,0.72)",
} as const;

export const scrimGradient = {
  soft: [
    "rgba(246,243,241,0)",
    "rgba(246,243,241,0.5)",
    "rgba(246,243,241,0.96)",
  ] as const,
  strong: [
    "rgba(28,25,23,0)",
    "rgba(28,25,23,0.35)",
    "rgba(28,25,23,0.78)",
  ] as const,
} as const;

export const fonts = {
  regular: "GeneralSans-Regular",
  medium: "GeneralSans-Medium",
  semibold: "GeneralSans-Semibold",
  bold: "GeneralSans-Bold",
  serif: "Boska-Medium",
  serifBold: "Boska-Bold",
} as const;

export const DISCLAIMER = BRAND_COPY.disclaimer;
