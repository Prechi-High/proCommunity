import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppShell, ActionButton, SearchField, Skeleton, StatusMessage } from "@/components/unmask-ui";
import { Lightning, ArrowRight, UsersThree, Play, Sparkle, Check } from "@/components/icons";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { CreatorUpdates } from "@/components/unmask-ui/CreatorUpdates";
import { UltraGuide, CreatorAnswers } from "@/components/home/HomeSections";
import { MonthlySparkCard } from "@/components/home/MonthlySparkCard";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";
import { entrySeen } from "@/lib/entry/api";
import { memberIdentity, claimIdentity } from "@/lib/membership";
import { identity as publicIdentity } from "@/lib/profiles/api";
import { hapticSuccess } from "@/lib/haptics";
import { colors, fonts } from "@/constants/theme";
const copy = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
export default function Home() {
  const r = useRouter(), qc = useQueryClient(), scan = useScan();
  const profile = useAppStore(s => s.profile), uid = profile?.id;
  const [seen, setSeen] = useState<boolean | null>(null), [q, setQ] = useState("");
  const [guide, setGuide] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const member = useQuery({ queryKey: ["member-identity", uid], queryFn: () => memberIdentity(uid!), enabled: !!uid });
  const person = useQuery({ queryKey: ["public-identity", uid], queryFn: () => publicIdentity(uid!), enabled: !!uid });
  const name = person.data?.display_name || profile?.displayName || "Unmasker";
  useEffect(() => { void entrySeen().then(setSeen).catch(() => setSeen(true)); }, []);
  useEffect(() => { if (seen === false && !uid) r.replace("/welcome"); }, [seen, uid, r]);
  function search() { if (q.trim().length > 1) r.push({ pathname: "/results", params: { q: q.trim() } } as Href); }
  async function claim() {
    if (!uid) { r.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/" } } as Href); return; }
    if (busy) return;
    setBusy(true); setError("");
    try { await claimIdentity(); await qc.invalidateQueries({ queryKey: ["member-identity", uid] }); hapticSuccess(); }
    catch { setError("Your ring couldn’t be claimed. Please try again."); } finally { setBusy(false); }
  }
  if (!uid && seen !== true) return <AppShell notify><Skeleton height={250} /></AppShell>;
  return <AppShell notify>
    <View style={{ gap: 17, paddingTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.brandDeep, letterSpacing: 1 }}>YOUR PEOPLE. YOUR VOICE.</Text><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 27, lineHeight: 33, letterSpacing: -0.8, color: colors.ink }}>{uid ? `Hey, ${name.split(" ")[0]}.` : "You belong here."}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my Unmasker profile" onPress={() => r.push("/you")}><MemberAvatar name={name} uri={person.data?.avatar_url} size={47} claimed={!!member.data} preview={!member.data} /></Pressable>
      </View>
      <View style={{ gap: 12, padding: 18, borderRadius: 24, backgroundColor: "#F6F3F1", borderWidth: 1, borderColor: "#EEE7E1" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 21, lineHeight: 26, letterSpacing: -0.5, color: colors.ink }}>Before you buy, ask the people.</Text>
        <SearchField value={q} onChange={setQ} onSubmit={search} onCamera={scan.openCamera} placeholder="Which product should we unmask?" />
        {q.trim().length > 1 ? <ActionButton label="Unmask this product" onPress={search} icon={<ArrowRight size={18} color="#fff" />} /> : null}
        <Text style={{ ...copy, fontSize: 12, lineHeight: 18 }}>Real experiences first. No answers yet? Ask your community.</Text>
      </View>
    </View>
    <View style={{ marginHorizontal: -20, marginTop: 2 }}><CreatorUpdates /></View>
    <MonthlySparkCard />
    <LinearGradient colors={["#4E1E33", "#25111F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 27, padding: 22, overflow: "hidden", gap: 14 }}>
      <View pointerEvents="none" style={{ position: "absolute", right: -35, top: -34, width: 180, height: 180, borderWidth: 1, borderColor: "#8B5A7133", borderRadius: 100, alignItems: "center", justifyContent: "center" }}><View style={{ width: 135, height: 135, borderWidth: 1, borderColor: "#8B5A7144", borderRadius: 100, alignItems: "center", justifyContent: "center" }}><Lightning size={70} weight="fill" color="#E6C77822" /></View></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Lightning size={17} weight="fill" color="#F2D25B" /><Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, color: "#E7C983" }}>ULTRA UNMASK</Text></View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 27, lineHeight: 32, letterSpacing: -0.7, color: "#fff", maxWidth: 290 }}>Your story deserves{"\n"}more than a comment.</Text>
      <Text style={{ ...copy, color: "#E9D8E0", maxWidth: 500 }}>Loved it? Let down? Spark a closer look. A creator can ask the company or an expert why.</Text>
      <ActionButton tone="gold" label="Take my story further" onPress={() => r.push("/investigation/request")} />
      <Pressable accessibilityRole="button" onPress={() => setGuide(true)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Play size={15} weight="fill" color="#fff" /><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "#fff" }}>See how Ultra Unmask works</Text></Pressable>
    </LinearGradient>
    <View style={{ padding: 21, borderRadius: 27, backgroundColor: "#F4EBF0", borderWidth: 1, borderColor: "#ECDCE4", gap: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 17 }}>
        <MemberAvatar name={name} uri={person.data?.avatar_url} size={76} claimed={!!member.data} preview={!member.data} />
        <View style={{ flex: 1, gap: 6 }}><Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1, color: colors.brandDeep }}>A LITTLE MARK. A REAL BELONGING.</Text><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 23, lineHeight: 28, color: colors.ink }}>{member.data ? "That’s your ring." : "Make it yours."}</Text><Text style={{ ...copy, fontSize: 13, lineHeight: 20 }}>{member.data ? "Your Unmasker identity travels with your public profile." : "Claim your free Unmasker ring. Let your people recognise you."}</Text></View>
      </View>
      {member.isLoading && uid ? <Skeleton height={44} /> : member.data ? <ActionButton tone="secondary" label="See my profile" icon={<Check size={17} color={colors.ink} />} onPress={() => r.push(`/member/${uid}` as Href)} /> : <ActionButton label="Claim my Unmasker ring" icon={<Sparkle size={18} color="#fff" />} pending={busy} pendingLabel="Making it yours…" onPress={() => void claim()} />}
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <Pressable accessibilityRole="link" onPress={() => r.push("/founding" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderTopWidth: 1, borderColor: "#DDC9D4", paddingTop: 13 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Here from the beginning?</Text><Text style={{ ...copy, fontSize: 12 }}>The founding circle · program preview</Text></View><ArrowRight size={20} color={colors.brandDeep} /></Pressable>
    </View>
    <CreatorAnswers />
    <Pressable accessibilityRole="link" onPress={() => r.navigate("/community" as Href)} style={({ pressed }) => ({ padding: 20, borderRadius: 24, backgroundColor: pressed ? "#E8DCE5" : "#F3EDF1", flexDirection: "row", alignItems: "center", gap: 13 })}><UsersThree size={28} color={colors.brandDeep} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>Your people are in here.</Text><Text style={{ ...copy, fontSize: 13 }}>Ask. Share. Be part of the conversation.</Text></View><ArrowRight size={20} color={colors.ink} /></Pressable>
    <UltraGuide open={guide} onClose={() => setGuide(false)} />{scan.sheet}
  </AppShell>;
}
