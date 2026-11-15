import { Platform } from "react-native";

import { useAppStore } from "@/lib/store";

/** Web: start persist rehydrate without blocking first paint. */
export function kickWebHydration() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  void useAppStore.persist.rehydrate();
}