import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppShell, ActionButton, SearchField, Skeleton, StatusMessage } from "@/components/unmask-ui";
import { Lightning, ArrowRight, UsersThree, Play, SealCheck, Camera } from "@/components/icons";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { UltraGuide, CreatorAnswers } from "@/components/home/HomeSections";
import { useAppStore } from "@/lib/store";
import { useScan } from "@/lib/useScan";
import { entrySeen } from "@/lib/entry/api";
import { wallet } from "@/lib/investigations/api";
import { memberIdentity, claimIdentity } from "@/lib/membership";
import { hapticSuccess } from "@/lib/haptics";
import { colors, fonts } from "@/constants/theme";

const copy = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
export default function Home() {
  const r = useRouter(), qc = useQueryClient(), scan = useScan();
  const profile = useAppStore(s => s.profile), uid = profile?.id;
  const [seen, setSeen] = useState<boolean | null>(null), [q, setQ] = useState("");
  const [guide, setGuide] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const balance = useQuery({ queryKey: ["spark-wallet", uid], queryFn: wallet, enabled: !!uid });
  const identity = useQuery({ queryKey: ["member-identity", uid], queryFn: () => memberIdentity(uid!), enabled: !!uid });
  useEffect(() => { void entrySeen().then(setSeen).catch(() => setSeen(true)); }, []);
  useEffect(() => { if (seen === false && !uid) r.replace("/welcome"); }, [seen, uid, r]);
  function search() { if (q.trim().length > 1) r.push({ pathname: "/results", params: { q: q.trim() } } as Href); }
  async function claim() {
    if (!uid) { r.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/" } } as Href); return; }
    if (busy) return;
    setBusy(true); setError("");
    try { await claimIdentity(); await qc.invalidateQueries({ queryKey: ["member-identity", uid] }); hapticSuccess(); }
    catch { setError("Your ring couldn’t be claimed. Please try again."); }
    finally { setBusy(false); }
  }
  if (!uid && seen !== true) return <AppShell notify><Skeleton height={250} /></AppShell>;
  return <AppShell notify>
    <View style={{ gap: 14, paddingTop: 16 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1, color: colors.brandDeep }}>BEFORE YOU BUY. AFTER YOU TRY.</Text>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 38, lineHeight: 43, letterSpacing: -1.3, color: colors.ink }}>Know the product.{"\n"}Hear from its people.</Text>
      <Text style={copy}>Unmask a product. See real experiences from people who’ve used it, before you decide.</Text>
      <SearchField value={q} onChange={setQ} onSubmit={search} onCamera={scan.openCamera} placeholder="Which product are you thinking of?" />
      <ActionButton label="Unmask this product" disabled={q.trim().length < 2} onPress={search} icon={<ArrowRight size={19} color="#fff" />} />
      <Pressable accessibilityRole="button" accessibilityLabel="Unmask a product with a photo" onPress={scan.openCamera}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44 }}>
        <Camera size={18} color={colors.ink} /><Text style={{ ...copy, fontFamily: fonts.medium, color: colors.ink }}>Or take a product photo</Text>
      </Pressable>
      <Text style={{ ...copy, fontSize: 13, lineHeight: 20 }}>No experiences yet? Ask the community. Someone who’s tried it can help.</Text>
    </View>

    <LinearGradient colors={["#4A1B2B", "#260E16"]} style={{ borderRadius: 28, padding: 24, gap: 17, marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Lightning size={22} weight="fill" color="#F2D25B" /><Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.1, color: "#F2D25B" }}>ULTRA UNMASK</Text></View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 29, lineHeight: 34, letterSpacing: -0.6, color: "#fff" }}>Don’t just wonder why.{"\n"}Let’s take it further.</Text>
      <Text style={{ ...copy, color: "#EFDEE4" }}>Loved it? Let down? Share your story and add Sparks. A creator can ask the company or an expert why—and share what they find.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["Your story", "Community Sparks", "Creator answers"].map((text, i) => <View key={text} style={{ flex: 1, borderTopWidth: 1, borderColor: "#80515E", paddingTop: 11, gap: 5 }}><Text style={{ fontFamily: fonts.medium, fontSize: 11, color: "#E5C77E" }}>0{i + 1}</Text><Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: "#fff" }}>{text}</Text></View>)}
      </View>
      <ActionButton tone="gold" label="Start an Ultra Unmask" onPress={() => r.push("/investigation/request")} />
      <Pressable accessibilityRole="button" onPress={() => setGuide(true)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Play size={18} color="#fff" weight="fill" /><Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#fff" }}>What happens in an Ultra Unmask?</Text>
      </Pressable>
      <View style={{ borderTopWidth: 1, borderColor: "#724350", paddingTop: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#E5C77E" }}>YOUR SPARKS</Text>
            {uid && balance.isLoading ? <Skeleton width={100} height={29} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 23, color: "#fff" }}>{!uid ? "Your voice, amplified" : balance.isError ? "Balance unavailable" : `${(balance.data?.sparks ?? 0).toLocaleString()} Sparks`}</Text>}
            {uid && !balance.isLoading && !balance.isError ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: "#EFDEE4" }}>{balance.data?.thunder ?? 0} Thunder Sparks</Text> : null}
          </View>
          <ActionButton tone="gold" label={uid ? "Add Sparks" : "Sign in"} onPress={() => r.push(uid ? "/wallet/recharge" : "/(auth)/sign-in")} />
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: "#DFCBD2" }}>Sparks support stories getting a closer look. They don’t buy a verdict or guarantee a company reply.</Text>
        {balance.isError ? <ActionButton tone="gold" label="Retry balance" onPress={() => void balance.refetch()} /> : null}
      </View>
    </LinearGradient>

    <CreatorAnswers />

    <View style={{ padding: 22, borderRadius: 24, backgroundColor: "#F6F2EE", gap: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <MemberAvatar name={profile?.displayName || "You"} claimed={!!identity.data} preview={!identity.data} />
        <View style={{ flex: 1, gap: 5 }}><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 21, color: colors.ink }}>You’re an Unmasker.</Text><Text style={copy}>Your experience can help someone choose better. There’s a place for you here.</Text></View>
      </View>
      {identity.isLoading && uid ? <Skeleton height={44} /> : identity.data ? <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}><SealCheck size={20} color={colors.brandDeep} /><Text style={{ ...copy, fontFamily: fonts.medium, color: colors.ink }}>Your Unmasker ring is claimed.</Text></View> : <ActionButton tone="secondary" label="Claim my free Unmasker ring" pending={busy} pendingLabel="Claiming…" onPress={() => void claim()} />}
      <Text style={{ ...copy, fontSize: 12, lineHeight: 18 }}>Free. Your claimed ring appears on your public profile.</Text>
      {error ? <StatusMessage kind="error" title={error} /> : null}
      <Pressable accessibilityRole="link" onPress={() => r.push("/founding" as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>Here from the beginning?</Text><Text style={{ ...copy, fontSize: 13 }}>Explore the founding-member program · preview</Text></View><ArrowRight size={21} color={colors.ink} />
      </Pressable>
    </View>
    <Pressable accessibilityRole="link" onPress={() => r.navigate("/community" as Href)} style={({ pressed }) => ({ padding: 20, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? "#F5EFE9" : "#fff", flexDirection: "row", alignItems: "center", gap: 13 })}>
      <UsersThree size={28} color={colors.brandDeep} /><View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>Meet your community.</Text><Text style={copy}>Ask, share, and follow the stories that matter to you.</Text></View><ArrowRight size={20} color={colors.ink} />
    </Pressable>
    <UltraGuide open={guide} onClose={() => setGuide(false)} />
    {scan.sheet}
  </AppShell>;
}
