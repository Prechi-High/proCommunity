import { Platform, useColorScheme } from "react-native";

import { applyThemeColors } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

/** Editorial palette for the movement surfaces. Reads the live theme, including system. */
export function useMovementPalette() {
  const themeMode = useAppStore((state) => state.themeMode);
  const scheme = useColorScheme();
  const systemDark =
    scheme === "dark" ||
    (Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  applyThemeColors(themeMode, systemDark);
  const dark = themeMode === "dark" || (themeMode === "system" && systemDark);
  return {
    dark,
    page: dark ? "#0B0909" : "#F6F1EA",
    card: dark ? "#161210" : "#FFFCF8",
    ink: dark ? "#F4EEE9" : "#1C1917",
    muted: dark ? "#C4B6AE" : "#5C534F",
    line: dark ? "#3A302C" : "#E4D9D0",
    wine: dark ? "#E7C4CE" : "#3D0F15",
    gold: dark ? "#F0CF69" : "#7A4B00",
    goldLine: dark ? "#F0CF69" : "#C9A227",
    button: dark ? "#F0CF69" : "#3D0F15",
    buttonText: dark ? "#1C1917" : "#F7F1EA",
    quiet: dark ? "#241C1A" : "#F3EBE4",
    cream: "#F7F1EA",
  };
}
