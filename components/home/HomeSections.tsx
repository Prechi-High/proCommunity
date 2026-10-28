import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ActionButton, ActionSheet, ContentSkeleton, MediaFrame, StatusMessage } from "@/components/unmask-ui";
import { ChatCircle, Lightning, Play, UsersThree, ArrowRight } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { publications } from "@/lib/community-v2/api";
import { safeLink } from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
import { SAMPLE_FEED } from "@/lib/unmask/samples";

const body = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
export function UltraGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <ActionSheet open={open} onClose={onClose} title="A closer look. Together.">
    <Text style={body}>Unmask shows people’s experiences. Ultra Unmask asks the next question: why did it happen?</Text>
    {[
      { Icon: ChatCircle, title: "1. Bring your story", detail: "Share a great result, a disappointment, or something you want explained." },
      { Icon: Lightning, title: "2. Give it a Spark", detail: "You and the community can add Sparks to support a closer look. Claim 50 free Sparks each month, or recharge for more. Sparks support a closer look; they don’t decide whether a claim is true." },
      { Icon: UsersThree, title: "3. A creator takes it further", detail: "When selected, an assigned creator gathers context and can ask the company or an expert. Their findings are shared with everyone." },
    ].map(({ Icon, title, detail }) => <View key={title} style={{ flexDirection: "row", gap: 13, paddingVertical: 9 }}><View style={{ padding: 10, borderRadius: 14, backgroundColor: "#F5EFE9", alignSelf: "flex-start" }}><Icon size={23} color={colors.brandDeep} /></View><View style={{ flex: 1, gap: 5 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}>{title}</Text><Text style={body}>{detail}</Text></View></View>)}
    <View style={{ borderRadius: 18, backgroundColor: "#F5F1ED", padding: 16, flexDirection: "row", gap: 12, alignItems: "center" }}><Play size={25} color={colors.brandDeep} /><View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>The short video guide</Text><Text style={{ ...body, fontSize: 13 }}>Coming soon. The steps above explain how it works today.</Text></View></View>
    <Text style={{ ...body, fontSize: 13 }}>Sparks don’t guarantee selection, a particular finding, or a response from a company. You can read and ask the community without buying Sparks.</Text>
    <ActionButton label="Got it" onPress={onClose} />
  </ActionSheet>;
}
export function CreatorAnswers() {
  const r = useRouter(), demo = useAppStore(s => s.demoCommunity);
  const q = useQuery({ queryKey: ["home-creator-answers"], queryFn: () => publications() });
  const rows = (q.data || []).filter(p => !!safeLink(p.video_url)).slice(0, 3);
  const examples = SAMPLE_FEED.filter(p => p.kind === "unmask" && p.status === "Example answer").slice(0, 1);
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 23, color: colors.ink }}>See what creators found.</Text><Pressable accessibilityRole="link" accessibilityLabel="Meet Unmask creators" onPress={() => r.push("/creators")} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}><ArrowRight size={22} color={colors.ink} /></Pressable></View>
    {q.isLoading ? <ContentSkeleton rows={2} /> : q.isError ? <><StatusMessage title="Creator answers couldn’t load." /><ActionButton tone="ghost" label="Try again" onPress={() => void q.refetch()} /></> : rows.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>{rows.map(p => <Pressable key={p.id} accessibilityRole="link" accessibilityLabel={`Watch ${p.title} — opens creator video`} onPress={() => { const url = safeLink(p.video_url); if (url) void Linking.openURL(url); }} style={{ width: 278, gap: 10 }}><MediaFrame uri={p.thumbnail_url} label={p.title} ratio={16 / 9} corners={false} play /><Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23, color: colors.ink }}>{p.title}</Text>{p.commercial_disclosure ? <Text style={{ ...body, fontSize: 12 }}>{p.commercial_disclosure}</Text> : null}</Pressable>)}</ScrollView> : demo && examples.length ? examples.map(p => <Pressable key={p.id} accessibilityRole="link" onPress={() => r.push(p.href as Href)} style={{ borderRadius: 22, overflow: "hidden", backgroundColor: "#F5F1ED" }}><MediaFrame uri={p.productImage} label={p.productName || p.title} ratio={16 / 7} corners={false} /><View style={{ padding: 16, gap: 7 }}><Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.7, color: colors.inkSoft }}>DESIGN DEMO · EXAMPLE ANSWER</Text><Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>{p.title}</Text><Text style={body}>Explore the format. This isn’t a real creator finding.</Text></View></Pressable>) : <View style={{ borderRadius: 22, backgroundColor: "#F5F1ED", padding: 22, gap: 10 }}><UsersThree size={30} color={colors.brandDeep} /><Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>The next answer starts with your story.</Text><Text style={body}>Published creator videos will appear here. Until then, meet the people bringing clarity to the community.</Text></View>}
    <ActionButton tone="secondary" label="Could you be an Unmask Creator?" onPress={() => r.push("/creator-program" as Href)} />
    <ActionButton tone="ghost" label="Explore Ultra Unmasks" onPress={() => r.push("/ultra-unmask" as Href)} />
  </View>;
}
