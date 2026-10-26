import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
export function useTrackingDraft<T extends object>(
  key: string,
  initial: T,
  resumeKey?: string,
) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let alive = true;
    setReady(false);
    setRestored(false);
    setValue(initial);
    void AsyncStorage.getItem(resumeKey || key)
      .then((raw) => {
        if (alive && raw) {
          setRestored(true);
          try {
            setValue({ ...initial, ...JSON.parse(raw) });
          } catch {}
        }
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void AsyncStorage.setItem(key, JSON.stringify(value));
    }, 350);
    return () => clearTimeout(t);
  }, [key, value, ready]);
  return {
    value,
    setValue,
    ready,
    restored,
    clear: () => AsyncStorage.multiRemove(resumeKey ? [key, resumeKey] : [key]),
  };
}
