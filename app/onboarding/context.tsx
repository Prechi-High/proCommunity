import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useRouter, useLocalSearchParams, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { EntryPage, EntryTitle } from "@/components/entry/Page";
import {
  Button,
  Copy,
  Card,
  Heading,
  Busy,
  Chips,
  Notice,
} from "@/components/unmask/reference/ui";
import { setup, saveSetup, safeReturn, markEntrySeen } from "@/lib/entry/api";
import { useAppStore } from "@/lib/store";
export default function Context() {
  const r = useRouter();
  const qc = useQueryClient();
  const ret = safeReturn(
    useLocalSearchParams<{ returnTo?: string }>().returnTo,
  );
  const uid = useAppStore((s) => s.profile?.id);
  const [skin, setSkin] = useState("Prefer not to say");
  const [sensitive, setSensitive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await setup();
      setSkin(p?.skin_type || "Prefer not to say");
      setSensitive(p?.sensitive_skin || false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load context.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (uid) void load();
    else setLoading(false);
  }, [uid]);
  const finish = async (skip = false) => {
    setBusy(true);
    setError("");
    try {
      await saveSetup({
        onboarding_completed_at: new Date().toISOString(),
        ...(!skip
          ? {
              skin_type: skin === "Prefer not to say" ? null : skin,
              sensitive_skin: sensitive,
            }
          : {}),
      });
      await markEntrySeen().catch(() => undefined);
      await qc.invalidateQueries({ queryKey: ["entry-setup"] });
      await qc.invalidateQueries({ queryKey: ["living"] });
      r.replace(
        (ret?.startsWith("/onboarding") ? "/(tabs)" : ret || "/(tabs)") as Href,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save setup.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <EntryPage back>
      <Copy small>● ━ ● STEP 2 OF 2</Copy>
      <EntryTitle>A little context, if you choose.</EntryTitle>
      <Copy muted>
        Keep a record of the context you may want to include in future product
        experiences.
      </Copy>
      {!uid ? (
        <Button
          label="Sign in to save context"
          onPress={() =>
            r.replace("/(auth)/sign-in?returnTo=/onboarding/context")
          }
        />
      ) : (
        <>
          <Busy loading={loading} />
          <Card>
            <Heading>Skincare context · optional</Heading>
            <Copy>Skin type</Copy>
            <Chips
              options={[
                "Prefer not to say",
                "Dry",
                "Oily",
                "Combination",
                "Normal",
                "Not sure",
              ]}
              value={skin}
              onChange={setSkin}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Copy>Sensitive skin</Copy>
              <Switch
                accessibilityLabel="Sensitive skin"
                value={sensitive}
                onValueChange={setSensitive}
              />
            </View>
          </Card>
          <Card>
            <Heading>Private by default.</Heading>
            <Copy>
              These details are only visible to you. Choose separately which
              details to include when sharing an experience.
            </Copy>
          </Card>
          <Copy small>These details are self-described, not a diagnosis.</Copy>
          {error ? <Notice>{error}</Notice> : null}
          <Button
            label={busy ? "Saving…" : "Finish setup →"}
            disabled={busy || loading || !!error}
            onPress={() => void finish()}
          />
          <Button
            quiet
            label="Skip for now"
            disabled={busy}
            onPress={() => void finish(true)}
          />
          {error ? (
            <Button
              quiet
              label="Retry loading context"
              onPress={() => void load()}
            />
          ) : null}
        </>
      )}
    </EntryPage>
  );
}
