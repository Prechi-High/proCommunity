import { useEffect, useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { EntryPage, EntryTitle } from "@/components/entry/Page";
import {
  LocationPicker,
  countries,
  statesFor,
} from "@/components/entry/LocationPicker";
import {
  ActionButton,
  ContentSkeleton,
  StatusMessage,
} from "@/components/unmask-ui";
import { Check, LockKey, UserCircle } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { currentSignIn, refreshAuthProfile } from "@/lib/auth";
import { safeReturn, setup } from "@/lib/entry/api";
import { useTrackingDraft } from "@/lib/tracking/draft";
import { useAppStore } from "@/lib/store";
const text = {
  fontFamily: fonts.regular,
  fontSize: 15,
  lineHeight: 23,
  color: colors.inkSoft,
};
const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  padding: 17,
  borderRadius: 17,
  borderWidth: 1,
  borderColor: colors.line,
  color: colors.ink,
  backgroundColor: "#FAF8F6",
};
export default function CompleteAccount() {
  const r = useRouter(),
    p = useLocalSearchParams<{ returnTo?: string }>(),
    ret = safeReturn(p.returnTo),
    profile = useAppStore((s) => s.profile);
  const draft = useTrackingDraft(
    `unmask:account-setup:${profile?.id || "pending"}`,
    {
      name: profile?.displayName || "",
      handle: "",
      country: "",
      region: "",
      ageBand: "",
      step: 0,
    },
  );
  const d = draft.value,
    set = (v: Partial<typeof d>) => draft.setValue((old) => ({ ...old, ...v }));
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void currentSignIn().then((s) => {
      if (!s)
        r.replace({
          pathname: "/(auth)/sign-in",
          params: { returnTo: "/complete-account" },
        } as Href);
    });
  }, [r]);
  const valid =
    d.step === 0
      ? d.name.trim().length >= 2 && /^[a-z0-9_]{3,24}$/.test(d.handle)
      : d.step === 1
        ? !!d.ageBand
        : d.step === 2
          ? !!d.country && (!statesFor(d.country).length || !!d.region)
          : password.length >= 10 && password === confirm;
  async function save() {
    if (busy || !supabase || !valid) return;
    setBusy(true);
    setError("");
    try {
      const country = countries.find((c) => c.isoCode === d.country);
      if (!country) throw new Error("Choose your country.");
      const { error: e } = await supabase.rpc("unmask_complete_profile", {
        p_name: d.name.trim(),
        p_handle: d.handle,
        p_country: country.name,
        p_region: d.region,
        p_age_band: d.ageBand,
      });
      if (e)
        throw new Error(
          e.code === "23505"
            ? "That username is taken. Go back and choose another."
            : e.message,
        );
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setPassword("");
      setConfirm("");
      await refreshAuthProfile();
      await draft.clear();
      const prefs = await setup();
      r.replace(
        (prefs?.onboarding_completed_at
          ? ret || "/(tabs)"
          : "/onboarding/interests" +
            (ret ? "?returnTo=" + encodeURIComponent(ret) : "")) as Href,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t finish your profile. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!draft.ready)
    return (
      <EntryPage>
        <ContentSkeleton />
      </EntryPage>
    );
  return (
    <EntryPage back>
      <View style={{ flexDirection: "row", gap: 7 }}>
        {["Your identity", "Your age", "Your location", "Your password"].map((label, i) => (
          <View key={label} style={{ flex: 1, gap: 7 }}>
            <View
              style={{
                height: 4,
                borderRadius: 3,
                backgroundColor: d.step >= i ? colors.brandDeep : "#E8E1DD",
              }}
            />
            <Text style={{ ...text, fontSize: 11 }}>
              {i + 1}. {label}
            </Text>
          </View>
        ))}
      </View>
      <EntryTitle>
        {
          [
            "Make yourself at home.",
            "A little about your age.",
            "Where are you joining from?",
            "One last thing. Make it yours.",
          ][d.step]
        }
      </EntryTitle>
      {d.step === 0 ? (
        <>
          <Text style={text}>
            Your name and @username help people recognise you. Your email stays
            private.
          </Text>
          <Text style={text}>Your name</Text>
          <TextInput
            accessibilityLabel="Your real name"
            value={d.name}
            onChangeText={(name) => set({ name })}
            maxLength={40}
            placeholder="What should we call you?"
            style={field}
          />
          <Text style={text}>Username</Text>
          <TextInput
            accessibilityLabel="Username"
            value={d.handle}
            onChangeText={(v) =>
              set({ handle: v.toLowerCase().replace(/[^a-z0-9_]/g, "") })
            }
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            placeholder="your_username"
            style={field}
          />
          <Text style={{ ...text, fontSize: 12 }}>
            3–24 letters, numbers or underscores.
          </Text>
        </>
      ) : d.step === 1 ? (
        <>
          <Text style={text}>Your age range</Text>
          <View style={{ gap: 10 }}>
            {["13-17", "18-24", "25-34", "35-44", "45-54", "55+"].map((age) => (
              <Pressable key={age} accessibilityRole="radio" accessibilityState={{ checked: d.ageBand === age }} onPress={() => set({ ageBand: age })} style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: d.ageBand === age ? colors.brandDeep : colors.line, backgroundColor: d.ageBand === age ? "#F2E8EF" : "#FAF8F6" }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}>{age}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ ...text, fontSize: 12 }}>This is kept private. Unmask uses the age band for safety, demographics and future compatibility signals.</Text>
        </>
      ) : d.step === 2 ? (
        <LocationPicker
          country={d.country}
          region={d.region}
          onChange={(country, region) => set({ country, region })}
        />
      ) : (
        <>
          <View
            style={{
              alignSelf: "flex-start",
              padding: 16,
              borderRadius: 20,
              backgroundColor: "#F2E8EF",
            }}
          >
            <LockKey size={29} color={colors.brandDeep} />
          </View>
          <Text style={text}>
            Your email is verified. Set a password to sign in next time. You can
            still use an email code.
          </Text>
          <TextInput
            accessibilityLabel="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            style={field}
          />
          <TextInput
            accessibilityLabel="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Repeat your password"
            style={field}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShow(!show)}
            style={{ paddingVertical: 12 }}
          >
            <Text style={{ ...text, color: colors.ink }}>
              {show ? "Hide passwords" : "Show passwords"}
            </Text>
          </Pressable>
          <Text style={{ ...text, fontSize: 12 }}>
            Your password is protected by Supabase Auth. We never store it in
            your profile or draft.
          </Text>
        </>
      )}
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <ActionButton
        label={d.step < 2 ? "Continue" : "Finish my account"}
        pending={busy}
        pendingLabel="Saving…"
        disabled={!valid || busy}
        onPress={() =>
          d.step < 3 ? (setError(""), set({ step: d.step + 1 })) : void save()
        }
      />
      {d.step > 0 ? (
        <ActionButton
          tone="ghost"
          label="Previous step"
          disabled={busy}
          onPress={() => set({ step: d.step - 1 })}
        />
      ) : null}
    </EntryPage>
  );
}
