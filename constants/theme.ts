import { Platform, type ViewStyle } from "react-native";
import { BRAND_COPY } from "./brand";

/** Unmask premium visual system: midnight navy surfaces, violet actions, warm gold highlights. */
const lightColors = {
  wine: "#0B1020",
  wineDeep: "#10182B",
  lac: "#121C32",
  lac2: "#19243D",
  redact: "#F4F6FC",
  bone: "#F4F6FC",
  bone2: "#AAB5CC",
  bone3: "#7F8BA5",
  line: "#293650",
  sage: "#80D4AB",
  honey: "#E9C16B",
  coral: "#F08B8B",
  brand: "#A18AFF",
  brandDeep: "#8066F0",
  gold: "#E9C16B",
  goldSoft: "#352E25",
  headerBg: "#0B1020",
  hi: "#8066F0",
  hiSoft: "#211D3D",
  hiInk: "#F4F1FF",
  stage: "#141F36",
  shell: "#0B1020",
  ink: "#F4F6FC",
  inkSoft: "#AAB5CC",
  rosewood: "#A18AFF",
  rosewoodSoft: "#211D3D",
  honeySoft: "#352E25",
  honeyInk: "#E9C16B",
  honeyBadge: "#E9C16B",
  sageSoft: "#172D2A",
  sageInk: "#80D4AB",
  coralSoft: "#351F2A",
  mist: "#17223A",
  white: "#111B30",
  black: "#F4F6FC",
  webShell: "#070B15",
  mark: "#2C2A3A",
  markInk: "#F4F6FC",
  markDark: "#A18AFF",
  markGood: "#19352E",
  markGoodInk: "#80D4AB",
  markBad: "#3A202A",
  markBadInk: "#F08B8B",
  marker: "#E9C16B",
  markerInk: "#111827",
  markerConcern: "#F08B8B",
} as const;

const darkColors = {
  ...lightColors,
  wine: "#070B15",
  wineDeep: "#0B1221",
  lac: "#0E1729",
  lac2: "#131F35",
  line: "#202D45",
  stage: "#101A2D",
  shell: "#070B15",
  headerBg: "#070B15",
  white: "#0D1729",
  webShell: "#040711",
  ink: "#F7F8FC",
  inkSoft: "#A3B0C8",
  brand: "#B29FFF",
  brandDeep: "#927BFF",
} as const;

export const colors = { ...lightColors } as Record<keyof typeof lightColors, string>;
export type ThemeMode = "system" | "light" | "dark";

export function applyThemeColors(mode: Exclude<ThemeMode, "system"> | "system", systemDark = false) {
  const palette = mode === "dark" || (mode === "system" && systemDark) ? darkColors : lightColors;
  Object.assign(colors, palette);
}

export const radii = {
  card: 18,
  button: 12,
  photo: 16,
  chip: 999,
  notice: 12,
  thumb: 12,
  search: 12,
  ib: 12,
  sheet: 24,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  sec: 44,
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
  button: 15,
  chip: 13,
  badge: 11,
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
    raised: { boxShadow: "0 1px 2px rgba(0,0,0,0.18), 0 12px 28px rgba(0,0,0,0.16)" },
    lifted: { boxShadow: "0 18px 50px rgba(0,0,0,0.28)" },
    fab: { boxShadow: "0 8px 24px rgba(0,0,0,0.28)" },
  },
  default: {
    flat: { shadowOpacity: 0, elevation: 0 },
    raised: { shadowColor: "#000000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
    lifted: { shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
    fab: { shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  },
}) as Record<"flat" | "raised" | "lifted" | "fab", ViewStyle>;

export const scrim = {
  soft: "rgba(4,7,17,0.35)",
  strong: "rgba(4,7,17,0.72)",
  onLight: "rgba(15,23,42,0.72)",
} as const;

export const scrimGradient = {
  soft: ["rgba(11,16,32,0)", "rgba(11,16,32,0.55)", "rgba(11,16,32,0.96)"] as const,
  strong: ["rgba(4,7,17,0)", "rgba(4,7,17,0.42)", "rgba(4,7,17,0.84)"] as const,
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
