import { useEffect, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { EntryPage, EntryTitle } from "@/components/entry/Page";
import {
  Button,
  Copy,
  Busy,
  Notice,
  ink,
} from "@/components/unmask/reference/ui";
import {
  Drop,
  Flower,
  House,
  ForkKnife,
  DeviceMobile,
} from "@/components/icons";
import { categories, setup, saveSetup, safeReturn } from "@/lib/entry/api";
import { fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
const icons = [Drop, Drop, Flower, DeviceMobile, House, ForkKnife];
export default function Interests() {
  const r = useRouter();
  const ret = safeReturn(
    useLocalSearchParams<{ returnTo?: string }>().returnTo,
  );
  const uid = useAppStore((s) => s.profile?.id);
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
      <Copy small>● ━ ○ 1 of 2</Copy>
      <EntryTitle>What are you curious about?</EntryTitle>
      <Copy muted>
        Choose a few interests to shape your investigation feed. You can change
        these anytime.
      </Copy>
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
                    borderColor: yes ? ink.brand : ink.line,
                    borderRadius: 20,
                    backgroundColor: yes ? ink.tint : "#fff",
                    padding: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 15,
                  }}
                >
                  <Text style={{ alignSelf: "flex-end", color: ink.brand }}>
                    {yes ? "● ✓" : "○"}
                  </Text>
                  <Icon size={40} color={yes ? ink.brand : ink.muted} />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      color: ink.text,
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
            label={busy ? "Saving…" : "Continue"}
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
