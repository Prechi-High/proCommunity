import { useEffect, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { EntryPage, EntryTitle } from "@/components/entry/Page";
import {
  Button,
  Copy,
  Busy,
  Notice,
} from "@/components/unmask/reference/ui";
import {
  Drop,
  Flower,
  House,
  ForkKnife,
  DeviceMobile,
} from "@/components/icons";
import { categories, setup, saveSetup, safeReturn } from "@/lib/entry/api";
import { colors, fonts } from "@/constants/theme";
import { useUnmaskTheme } from "@/lib/useUnmaskTheme";
import { useAppStore } from "@/lib/store";
const icons = [Drop, Drop, Flower, DeviceMobile, House, ForkKnife];
export default function Interests() {
  const r = useRouter();
  const ret = safeReturn(
    useLocalSearchParams<{ returnTo?: string }>().returnTo,
  );
  const uid = useAppStore((s) => s.profile?.id);
  useUnmaskTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await setup();
      setSelected(p?.interests || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load preferences.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (uid) void load();
    else setLoading(false);
  }, [uid]);
  const next = async (skip = false) => {
    setBusy(true);
    setError("");
    try {
      if (!skip) await saveSetup({ interests: selected });
      r.push(
        ("/onboarding/context" +
          (ret ? "?returnTo=" + encodeURIComponent(ret) : "")) as Href,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save interests.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <EntryPage back>
      <Copy small>YOU ARE AN UNMASKER</Copy>
      <EntryTitle>Context creates clarity.</EntryTitle>
      <Copy>Clarity creates confidence.</Copy>
      <Copy muted>
        Don’t just buy. Unmask. Start with one product. The interests below are
        optional. They only say what you live with.
      </Copy>
      <Copy>Ask why. Good for who? Truth needs context.</Copy>
      {!uid ? (
        <Button
          label="Sign in to save preferences"
          onPress={() =>
            r.replace("/(auth)/sign-in?returnTo=/onboarding/interests")
          }
        />
      ) : (
        <>
          <Busy
            loading={loading}
            error={error ? new Error(error) : null}
            retry={() => void load()}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {categories.map((c, i) => {
              const yes = selected.includes(c),
                Icon = icons[i];
              return (
                <Pressable
                  key={c}
                  accessibilityRole="checkbox"
                  accessibilityLabel={c}
                  accessibilityState={{ checked: yes }}
                  disabled={loading || busy}
                  onPress={() =>
                    setSelected((v) =>
                      v.includes(c) ? v.filter((x) => x !== c) : [...v, c],
                    )
                  }
                  style={{
                    width: "47%",
                    minHeight: 140,
                    borderWidth: 1.5,
                    borderColor: yes ? colors.brand : colors.line,
                    borderRadius: 20,
                    backgroundColor: yes ? colors.hiSoft : colors.stage,
                    padding: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 15,
                  }}
                >
                  <Text style={{ alignSelf: "flex-end", color: colors.brand }}>
                    {yes ? "● ✓" : "○"}
                  </Text>
                  <Icon size={40} color={yes ? colors.brand : colors.inkSoft} />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      color: colors.ink,
                      textAlign: "center",
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            label={busy ? "Saving…" : "Start with one product"}
            disabled={busy || loading || !!error}
            onPress={() => void next()}
          />
          <Button
            quiet
            label="Skip for now"
            disabled={busy}
            onPress={() => void next(true)}
          />
        </>
      )}
    </EntryPage>
  );
}
