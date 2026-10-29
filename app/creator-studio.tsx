import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";
import { supabase } from "@/lib/supabase";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";

const input = { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: "#FAF8F6", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14 };

export default function CreatorStudio() {
  const r = useRouter();
  const uid = useAppStore(s => s.profile?.id);
  const [creator, setCreator] = useState<any>(null);
  const [mode, setMode] = useState<"live" | "room">("live");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!uid) return;
    db().from("unmask_creators").select("*").eq("user_id", uid).maybeSingle().then(({ data }) => setCreator(data));
    db().from("unmask_realtime_sessions")
      .select("id,mode,title,description,status,metadata,started_at")
      .eq("host_creator_id", uid)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveSession(data || null));
  }, [uid]);

  async function endActiveSession() {
    if (!activeSession || ending || !supabase) return;
    setEnding(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token) throw new Error("Sign in required.");
      const response = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
        body: JSON.stringify({ action: "end", sessionId: activeSession.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not end the session.");
      setActiveSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end the session.");
    } finally {
      setEnding(false);
    }
  }

  async function start() {
    if (!uid || !creator || busy || !title.trim()) return;
    setBusy(true); setError("");
    try {
      if (!supabase) throw new Error("Connection unavailable.");
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token) throw new Error("Sign in required.");
      const response = await fetch("/api/realtime/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({
          mode,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not start the session.");
      if (!payload?.id) throw new Error("The session was created without an id.");
      r.replace({ pathname: mode === "live" ? "/live/session" : "/room/session", params: { id: payload.id, host: "1" } } as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session.");
    } finally { setBusy(false); }
  }

  if (!creator) return <AppShell back title="Creator Studio"><StatusMessage title="Creator access is not active." detail="Your account needs to be published as an Unmask Creator before you can start a Live or Room." /></AppShell>;

  return (
    <AppShell back title="Creator Studio" subtitle="Start something people can join right now.">
      <View style={{ padding: 20, borderRadius: 24, backgroundColor: "#F3EBE2", gap: 12 }}>
        <CreatorMark mark={creator.creator_mark || uid} size={58} label />
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 27, color: colors.ink }}>{creator.display_name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>@{creator.handle} · {creator.status}</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionButton label="Live video" tone={mode === "live" ? "primary" : "secondary"} onPress={() => setMode("live")} />
        <ActionButton label="Audio Room" tone={mode === "room" ? "primary" : "secondary"} onPress={() => setMode("room")} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>TITLE</Text>
        <TextInput value={title} onChangeText={setTitle} style={input} placeholder={mode === "live" ? "I'm investigating this product live" : "Let's talk about this product"} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>WHAT ARE WE DOING?</Text>
        <TextInput value={description} onChangeText={setDescription} style={[input, { minHeight: 100 }]} multiline placeholder="Give listeners enough context to decide whether to join." />
      </View>

      {error ? <StatusMessage kind="error" title={error} /> : null}
      <ActionButton label={mode === "live" ? "Start Live" : "Start Room"} pending={busy} pendingLabel="Starting…" disabled={!title.trim() || busy || !!activeSession} onPress={() => void start()} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.inkSoft }}>
        {mode === "room" ? "Rooms are public and audio-first. Listeners join muted; the host controls who gets speaking access." : "Live broadcasts are public. Camera and microphone permissions will be requested when you enter."}
      </Text>

      {activeSession ? (
        <View style={{ padding: 18, borderRadius: 22, backgroundColor: activeSession.mode === "room" ? "#F3EBE2" : "#2A0E16", gap: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: activeSession.mode === "room" ? colors.brandDeep : "#F2D25B" }}>
            {activeSession.mode === "room" ? "YOUR ROOM IS LIVE" : "YOUR LIVE IS ON"}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: activeSession.mode === "room" ? colors.ink : "#fff" }}>{activeSession.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: activeSession.mode === "room" ? colors.inkSoft : "#E9D8E0" }}>
            You are already the host. You don't need to start another session.
          </Text>
          <View style={{ flexDirection: "row", gap: 9 }}>
            <ActionButton tone={activeSession.mode === "room" ? "primary" : "gold"} label="Open controls" onPress={() => r.replace({ pathname: activeSession.mode === "room" ? "/room/session" : "/live/session", params: { id: activeSession.id, host: "1" } } as Href)} />
            <ActionButton tone="secondary" label={ending ? "Ending…" : "End now"} pending={ending} onPress={() => void endActiveSession()} />
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}
