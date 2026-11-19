import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";

/**
 * False when the app/tab is backgrounded or the document is hidden.
 * Use to pause story progress, video, and BGM so they don't keep running off-screen.
 */
export function usePageActive(): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const sync = (next?: AppStateStatus) => {
      const appOk = (next ?? AppState.currentState) === "active";
      const docOk =
        Platform.OS !== "web" ||
        typeof document === "undefined" ||
        !document.hidden;
      setActive(appOk && docOk);
    };

    sync();
    const sub = AppState.addEventListener("change", sync);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVis = () => sync();
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("pagehide", onVis);
      return () => {
        sub.remove();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pagehide", onVis);
      };
    }
    return () => sub.remove();
  }, []);

  return active;
}
