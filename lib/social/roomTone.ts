import { Platform, useColorScheme } from "react-native";

import { useUnmaskTheme } from "@/lib/useUnmaskTheme";
import { useAppStore } from "@/lib/store";

/** Night room is the default. Light mode keeps the same layout with readable ink. */
export function useRoomTone() {
  const theme = useUnmaskTheme();
  const mode = useAppStore((s) => s.themeMode);
  const scheme = useColorScheme();
  const systemDark =
    scheme === "dark" ||
    (Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const dark = mode === "dark" || (mode === "system" && systemDark);
  return {
    dark,
    text: dark ? "#FFF8F4" : theme.colors.ink,
    muted: dark ? "rgba(255,248,244,0.72)" : theme.colors.inkSoft,
    faint: dark ? "rgba(255,248,244,0.5)" : theme.colors.inkSoft,
    card: dark ? "rgba(255,248,244,0.06)" : theme.colors.white,
    chip: dark ? "rgba(255,255,255,0.16)" : theme.colors.mist,
    line: dark ? "rgba(255,248,244,0.16)" : theme.colors.line,
    gold: "#C9A227",
    dock: dark ? "rgba(18,8,16,0.92)" : "rgba(255,255,255,0.94)",
  };
}
