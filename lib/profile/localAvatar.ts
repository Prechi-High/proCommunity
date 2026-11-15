import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Local fallback when remote avatar upload fails or is pending sync. */
export const useLocalAvatar = create(
  persist<{ uri: string; setUri: (uri: string) => void; clear: () => void }>(
    (set) => ({
      uri: "",
      setUri: (uri) => set({ uri }),
      clear: () => set({ uri: "" }),
    }),
    { name: "unmask-local-avatar", storage: createJSONStorage(() => AsyncStorage) },
  ),
);