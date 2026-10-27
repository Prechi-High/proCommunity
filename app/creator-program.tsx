import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { ChatCircle, UsersThree, Play } from "@/components/icons";
import { Input } from "@/components/tracking/Fields";
import { useAppStore } from "@/lib/store";
import { sendSupport } from "@/lib/utilities/api";
import { colors, fonts } from "@/constants/theme";
const body = { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.inkSoft };
export default function CreatorProgram() {
  const r = useRouter(), uid = useAppStore(s => s.profile?.id);
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  async function send() {
    if (!uid) { r.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/creator-program" } } as Href); return; }
    if (busy || note.trim().length < 20) return;
    setBusy(true); setError("");
    try { await sendSupport("Unmask Creator program interest", "creator-program", note.trim()); setSent(true); }
    catch { setError("Couldn’t send your interest. Your text is still here."); } finally { setBusy(false); }
  }
  return <AppShell back navigation title="Be a voice for clarity." subtitle="The Unmask Creator program">
    <Text style={body}>Help people understand the products in their lives. Bring community stories, company responses and expert context together in clear, useful videos.</Text>
    {[
      [ChatCircle, "Start with people", "Listen to the person behind a story. Understand what they used, how they used it and what happened."],
      [UsersThree, "Ask better questions", "Ask companies and relevant experts for context. Explain what is known, what is uncertain and who might have a different experience."],
      [Play, "Share what you find", "Create an Ultra Unmask for the app and your audience. Great outcomes belong here too."],
    ].map(([Icon, title, detail]) => { const Symbol = Icon as typeof ChatCircle; return <View key={String(title)} style={{ padding: 20, borderRadius: 22, backgroundColor: "#F6F2EE", gap: 10 }}><Symbol size={27} color={colors.brandDeep} /><Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.ink }}>{String(title)}</Text><Text style={body}>{String(detail)}</Text></View>; })}
    <ActionButton tone="secondary" label="Meet the creators" onPress={() => r.push("/creators")} />
    {sent ? <StatusMessage kind="success" title="Your interest has been sent." detail="The Unmask team can review your message. This doesn’t grant creator access or promise a paid assignment." /> : <>
      <Input label="Tell us why you’d like to create (add a portfolio link if you have one)" multiline value={note} onChange={setNote} />
      <ActionButton label={uid ? "Send my creator interest" : "Sign in to express interest"} pending={busy} pendingLabel="Sending…" disabled={!!uid && note.trim().length < 20} onPress={() => void send()} />
    </>}
    {error ? <StatusMessage kind="error" title={error} /> : null}
    <Text style={{ ...body, fontSize: 13 }}>Unmask’s editorial team assigns stories. Selection, working terms and any earnings are agreed separately.</Text>
  </AppShell>;
}
