import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";

import { useMovementPalette } from "@/components/movement/palette";
import { ActionButton, AppShell, StatusMessage } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { loadCard, saveCard } from "@/lib/social/api";
import * as profiles from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";

const CONCERNS = ["Dryness", "Tightness", "Breakouts", "Dullness", "Sensitivity", "Shine", "Texture", "Marks"];

export default function EditCard() {
  const palette = useMovementPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((state) => state.profile);
  const identity = useQuery({
    queryKey: ["public-identity", profile?.id],
    queryFn: () => profiles.identity(profile!.id),
    enabled: !!profile,
  });
  const card = useQuery({
    queryKey: ["unmask-card", profile?.id],
    enabled: !!profile,
    queryFn: () => loadCard(profile!.id, true, profile!.displayName || "You", identity.data?.handle, identity.data?.avatar_url),
  });
  const [skin, setSkin] = useState("");
  const [hair, setHair] = useState("");
  const [routine, setRoutine] = useState("");
  const [goals, setGoals] = useState("");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!card.data) return;
    setSkin(card.data.skin || "");
    setHair(card.data.hair || "");
    setRoutine(card.data.routine || "");
    setGoals(card.data.goals || "");
    setConcerns(card.data.concerns);
  }, [card.data]);
  const save = async () => {
    if (!profile) {
      router.push("/sign-up" as Href);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveCard({ skin, hair, routine, goals, concerns });
      await qc.invalidateQueries({ queryKey: ["unmask-card", profile.id] });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your Unmask.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell back title="Edit my Unmask" subtitle="What you are happy for someone to see.">
      {!profile ? <ActionButton label="Get Started" onPress={() => router.push("/sign-up" as Href)} /> : null}
      <Field label="Skin" value={skin} onChange={setSkin} placeholder="Dry, combination, easily tight" />
      <Field label="Hair" value={hair} onChange={setHair} placeholder="Optional" />
      <Field label="Routine" value={routine} onChange={setRoutine} placeholder="What you actually do" multiline />
      <Field label="Looking for" value={goals} onChange={setGoals} placeholder="Optional" />
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>Concerns</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CONCERNS.map((item) => {
            const on = concerns.includes(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setConcerns((current) => on ? current.filter((row) => row !== item) : [...current, item].slice(0, 8))}
                style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: on ? palette.button : palette.card, borderWidth: 1, borderColor: on ? palette.button : palette.line }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? palette.buttonText : palette.ink }}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: palette.muted }}>
        Products and timelines show on the card when that journey is public.
      </Text>
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <ActionButton label={busy ? "Saving…" : "Save my Unmask"} disabled={busy || !profile} onPress={() => void save()} />
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const palette = useMovementPalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: palette.ink }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        multiline={multiline}
        style={{ minHeight: multiline ? 88 : 48, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, color: palette.ink, fontFamily: fonts.regular, fontSize: 16 }}
      />
    </View>
  );
}
