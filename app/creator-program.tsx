import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { ChatCircle, UsersThree, Play } from "@/components/icons";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";

const body = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
const input = { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: "#FAF8F6", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14 };

export default function CreatorProgram() {
  const r = useRouter();
  const uid = useAppStore(s => s.profile?.id);
  const profile = useAppStore(s => s.profile);
  const [creator, setCreator] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [name, setName] = useState(profile?.displayName || "");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      r.replace({ pathname: "/(auth)/sign-in", params: { returnTo: "/creator-program" } } as Href);
      return;
    }
    let alive = true;
    (async () => {
      const [c, a] = await Promise.all([
        db().from("unmask_creators").select("*").eq("user_id", uid).maybeSingle(),
        db().from("unmask_creator_applications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (!c.error) setCreator(c.data);
      if (!a.error) {
        setApplication(a.data);
        if (a.data) {
          setName(a.data.display_name); setHandle(a.data.handle); setBio(a.data.bio);
          setSpecialties((a.data.specialties || []).join(", ")); setReason(a.data.reason || "");
        }
      }
    })();
    return () => { alive = false; };
  }, [uid, r]);

  async function apply() {
    if (!uid || busy) return;
    const cleanHandle = handle.trim().toLowerCase();
    if (name.trim().length < 2 || !/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
      setError("Use a name and a username with 3–24 letters, numbers or underscores."); return;
    }
    setBusy(true); setError("");
    try {
      const { error: e } = await db().from("unmask_creator_applications").insert({
        user_id: uid, display_name: name.trim(), handle: cleanHandle, bio: bio.trim(),
        specialties: specialties.split(",").map(x => x.trim()).filter(Boolean).slice(0, 8),
        reason: reason.trim(),
      });
      if (e) throw e;
      const { data } = await db().from("unmask_creator_applications").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setApplication(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your creator application.");
    } finally { setBusy(false); }
  }

  if (creator) return (
    <AppShell back navigation title="Creator Studio" subtitle="Your Unmask creator identity.">
      <View style={{ padding: 22, borderRadius: 26, backgroundColor: "#F3EBE2", gap: 14 }}>
        <CreatorMark mark={creator.creator_mark || uid} size={64} label />
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 28, color: colors.ink }}>{creator.display_name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft }}>@{creator.handle} · {creator.status}</Text>
        <Text style={{ ...body }}>{creator.bio || "Your creator profile is live."}</Text>
        <ActionButton label="Open Creator Studio" onPress={() => r.push("/creator-studio" as Href)} />
        <ActionButton tone="secondary" label="View public profile" onPress={() => r.push({ pathname: "/creators", params: { id: uid } } as Href)} />
      </View>
    </AppShell>
  );

  return (
    <AppShell back navigation title="Be a voice for clarity." subtitle="The Unmask Creator program">
      <Text style={body}>Help people understand the products in their lives. Creators start with a 30-day trial and are reviewed on helpfulness, reliability, accuracy, communication and safety—not follower count.</Text>
      {[
        [ChatCircle, "Start with people", "Listen to the person behind a story. Understand what they used, how they used it and what happened."],
        [UsersThree, "Ask better questions", "Ask companies and relevant experts for context. Explain what is known, what is uncertain and what remains unclear."],
        [Play, "Share what you find", "Create public Live broadcasts, audio Rooms and Ultra Unmasks that become useful product intelligence."],
      ].map(([Icon, title, detail]) => {
        const Symbol = Icon as typeof ChatCircle;
        return <View key={String(title)} style={{ padding: 20, borderRadius: 22, backgroundColor: "#F6F2EE", gap: 10 }}>
          <Symbol size={27} color={colors.brandDeep} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>{String(title)}</Text>
          <Text style={body}>{String(detail)}</Text>
        </View>;
      })}
      {application ? (
        <View style={{ padding: 18, borderRadius: 20, backgroundColor: "#F3EBE2", gap: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.7, color: colors.brandDeep }}>APPLICATION {String(application.status).toUpperCase()}</Text>
          <Text style={body}>{application.status === "pending" ? "Your application is with the Unmask team." : application.status === "approved" ? "You’re approved. Your creator profile is ready for publishing." : "This application was not approved. You can submit a new one after making changes."}</Text>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>DISPLAY NAME</Text>
        <TextInput value={name} onChangeText={setName} style={input} placeholder="Your creator name" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>USERNAME</Text>
        <TextInput value={handle} onChangeText={v => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} autoCapitalize="none" style={input} placeholder="your_handle" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>BIO</Text>
        <TextInput value={bio} onChangeText={setBio} style={[input, { minHeight: 90 }]} multiline placeholder="What do you investigate or help people understand?" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>SPECIALTIES</Text>
        <TextInput value={specialties} onChangeText={setSpecialties} style={input} placeholder="Skincare, ingredients, haircare" />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>WHY YOU</Text>
        <TextInput value={reason} onChangeText={setReason} style={[input, { minHeight: 120 }]} multiline placeholder="What makes your product experience useful to other people?" />
      </View>
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <ActionButton label={application?.status === "pending" ? "Application submitted" : "Apply to be a creator"} disabled={!!application && application.status === "pending"} pending={busy} pendingLabel="Submitting…" onPress={() => void apply()} />
      <Text style={{ ...body, fontSize: 13 }}>Selection, working terms and any future opportunities are handled separately by the Unmask team.</Text>
    </AppShell>
  );
}
