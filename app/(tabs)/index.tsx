import { foundingMember } from "@/lib/membership";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppShell, ActionButton, SearchField, Skeleton, StatusMessage, RealtimeRail } from "@/components/unmask-ui";
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
  const founder = useQuery({ queryKey: ["founding-member", uid], queryFn: () => foundingMember(uid!), enabled: !!uid });
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
    <View style={{ gap: 16, paddingTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: "#B7A7FF", letterSpacing: 1.5 }}>YOUR PEOPLE. YOUR VOICE.</Text><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.9, color: colors.ink }}>{uid ? `Hey, ${name.split(" ")[0]}.` : "You belong here."}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my Unmasker profile" onPress={() => r.push("/you")}><MemberAvatar name={name} uri={person.data?.avatar_url} size={47} claimed={!!member.data} founding={!!founder.data} preview={!member.data} /></Pressable>
      </View>
      <View style={{ gap: 13, padding: 18, borderRadius: 18, backgroundColor: "#141F36", borderWidth: 1, borderColor: "#2B3955" }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.55, color: colors.ink }}>Before you buy, ask the people.</Text>
        <SearchField value={q} onChange={setQ} onSubmit={search} onCamera={scan.openCamera} placeholder="Which product should we unmask?" />
        {q.trim().length > 1 ? <ActionButton label="Unmask this product" onPress={search} icon={<ArrowRight size={18} color="#fff" />} /> : null}
        <Text style={{ ...copy, fontSize: 12, lineHeight: 18 }}>Real experiences first. No answers yet? Ask your community.</Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" onPress={() => r.push("/seller/onboarding")} style={{ marginTop: 0, padding: 16, borderRadius: 16, backgroundColor: "#1B2741", borderWidth: 1, borderColor: "#34435F", flexDirection: "row", alignItems: "center", gap: 14 }}><View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: "#fff" }}>Become a Seller Partner</Text><Text style={{ ...copy, color: "#CFCFC9", fontSize: 13, lineHeight: 19 }}>Create your Unmask storefront and sell with product intelligence behind it.</Text></View><ArrowRight size={20} color="#fff" /></Pressable>
    <Pressable accessibilityRole="link" onPress={() => r.push("/seller/onboarding" as Href)} style={{ marginTop: 0, padding: 16, borderRadius: 16, backgroundColor: "#171D35", borderWidth: 1, borderColor: "#3A315C", flexDirection: "row", alignItems: "center", gap: 14 }}><View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>Create your Unmask Store</Text><Text style={{ ...copy, fontSize: 13, lineHeight: 19 }}>Register as a seller, activate your storefront, and start adding products.</Text></View><ArrowRight size={20} color={colors.brandDeep} /></Pressable>
    <View style={{ marginHorizontal: -22, marginTop: 2, paddingVertical: 14, backgroundColor: "#0E1729", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}><CreatorUpdates /></View>
    <RealtimeRail />
    <MonthlySparkCard />
    <LinearGradient colors={["#1A2140", "#121A30"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 19, borderWidth: 1, borderColor: "#51427E", overflow: "hidden", gap: 12 }}>
      <View pointerEvents="none" style={{ position: "absolute", right: -35, top: -34, width: 180, height: 180, borderWidth: 1, borderColor: "#A18AFF30", borderRadius: 100, alignItems: "center", justifyContent: "center" }}><View style={{ width: 135, height: 135, borderWidth: 1, borderColor: "#A18AFF38", borderRadius: 100, alignItems: "center", justifyContent: "center" }}><Lightning size={70} weight="fill" color="#E6C77822" /></View></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Lightning size={17} weight="fill" color="#F2D25B" /><Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, color: "#E7C983" }}>ULTRA UNMASK</Text></View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 27, lineHeight: 32, letterSpacing: -0.7, color: "#fff", maxWidth: 290 }}>Your story deserves{"\n"}more than a comment.</Text>
      <Text style={{ ...copy, color: "#C2CBE0", maxWidth: 500 }}>Loved it? Let down? Spark a closer look. A creator can ask the company or an expert why.</Text>
      <ActionButton tone="gold" label="Take my story further" onPress={() => r.push("/investigation/request")} />\n      <Pressable accessibilityRole="link" onPress={() => r.push("/contribute" as Href)} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#C4B8FF" }}>Share an experience instead</Text><ArrowRight size={15} color="#C4B8FF" /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setGuide(true)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}><Play size={15} weight="fill" color="#fff" /><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "#fff" }}>See how Ultra Unmask works</Text></Pressable>
    </LinearGradient>
    <View style={{ padding: 18, borderRadius: 18, backgroundColor: "#141F36", borderWidth: 1, borderColor: "#2B3955", gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 17 }}>
        <MemberAvatar name={name} uri={person.data?.avatar_url} size={76} claimed={!!member.data} founding={!!founder.data} preview={!member.data} />
        <View style={{ flex: 1, gap: 6 }}><Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1, color: colors.brandDeep }}>A LITTLE MARK. A REAL BELONGING.</Text><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 23, lineHeight: 28, color: colors.ink }}>{member.data ? "That’s your ring." : "Make it yours."}</Text><Text style={{ ...copy, fontSize: 13, lineHeight: 20 }}>{member.data ? "Your Unmasker identity travels with your public profile." : "Claim your free Unmasker ring. Let your people recognise you."}</Text></View>
      </View>
      {member.isLoading && uid ? <Skeleton height={44} /> : member.data ? <ActionButton tone="secondary" label="See my profile" icon={<Check size={17} color={colors.ink} />} onPress={() => r.push(`/member/${uid}` as Href)} /> : <ActionButton label="Claim my Unmasker ring" icon={<Sparkle size={18} color="#fff" />} pending={busy} pendingLabel="Making it yours…" onPress={() => void claim()} />}
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <Pressable accessibilityRole="link" onPress={() => r.push("/founding" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderTopWidth: 1, borderColor: "#34435F", paddingTop: 13 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>Here from the beginning?</Text><Text style={{ ...copy, fontSize: 12 }}>The founding circle · program preview</Text></View><ArrowRight size={20} color={colors.brandDeep} /></Pressable>
    </View>
    <CreatorAnswers />
    <Pressable accessibilityRole="link" onPress={() => r.navigate("/community" as Href)} style={({ pressed }) => ({ padding: 18, borderRadius: 16, backgroundColor: pressed ? "#222D49" : "#141F36", borderWidth: 1, borderColor: "#2B3955", flexDirection: "row", alignItems: "center", gap: 13 })}><UsersThree size={28} color={colors.brandDeep} /><View style={{ flex: 1, gap: 3 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>Your people are in here.</Text><Text style={{ ...copy, fontSize: 13 }}>Ask. Share. Be part of the conversation.</Text></View><ArrowRight size={20} color={colors.ink} /></Pressable>
    <UltraGuide open={guide} onClose={() => setGuide(false)} />{scan.sheet}
  </AppShell>;
}
