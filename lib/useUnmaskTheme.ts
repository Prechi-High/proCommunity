import { Platform, useColorScheme } from "react-native";

import { applyThemeColors, colors, elevation, fonts, radii, space } from "@/constants/theme";
import { useAppStore } from "@/lib/store";

/** Read theme tokens during render so Room surfaces follow light, dark, and system. */
export function useUnmaskTheme() {
  const themeMode = useAppStore((state) => state.themeMode);
  const systemScheme = useColorScheme();
  const systemDark =
    systemScheme === "dark" ||
    (Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  applyThemeColors(themeMode, systemDark);
  return { colors, fonts, radii, space, elevation, themeMode };
}
