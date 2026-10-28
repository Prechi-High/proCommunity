import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, ContentSkeleton, StatusMessage } from "@/components/unmask-ui";
import { SealCheck, Lightning, Storefront, Clock } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { useAppStore } from "@/lib/store";
import { foundingInterest, joinFoundingInterest } from "@/lib/membership";
import { hapticSuccess } from "@/lib/haptics";
const copy = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };
export default function Founding() {
  const uid = useAppStore(s => s.profile?.id), r = useRouter(), qc = useQueryClient();
  const q = useQuery({ queryKey: ["founding-interest", uid], queryFn: foundingInterest, enabled: !!uid });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function join() {
    if (!uid) { r.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/founding" } } as Href); return; }
    if (busy) return;
    setBusy(true); setError("");
    try { await joinFoundingInterest(); await qc.invalidateQueries({ queryKey: ["founding-interest", uid] }); hapticSuccess(); }
    catch { setError("Couldn’t save your interest. Please try again."); } finally { setBusy(false); }
  }
  return <AppShell back navigation title="Here from the beginning." subtitle="Help shape the community you want to belong to.">
    <View style={{ padding: 24, borderRadius: 26, backgroundColor: "#F5EAD0", gap: 14 }}>
      <View style={{flexDirection:"row",alignItems:"center",gap:18}}><MemberAvatar name="F" size={60} founding preview/><View style={{flex:1,gap:5}}><Text style={{fontFamily:fonts.semibold,fontSize:18,color:colors.ink}}>The founding ring</Text><Text style={{...copy,fontSize:12}}>Design preview · not awarded yet</Text></View></View><Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, color: "#76551B" }}>FOUNDING CIRCLE · PROGRAM PREVIEW</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 29, lineHeight: 34, color: colors.ink }}>Your support can help build what comes next.</Text>
      <Text style={copy}>We’re designing a founding-member program for early Unmaskers. It isn’t open for purchase yet.</Text>
    </View>
    {[
      { Icon: SealCheck, title: "A badge that stays", detail: "A proposed permanent founding badge—even after time-limited benefits end. Your free Unmasker ring is separate." },
      { Icon: Lightning, title: "Support the first stories", detail: "We’re considering a verified Spark purchase during the launch window as the qualifying action. Buying Sparks does not currently grant founding status." },
      { Icon: Storefront, title: "Partner savings, for a year", detail: "Proposed monthly Unmask Coins for 12 months, usable on eligible offers from independent partner sellers. These would be discount credits, not cash or Sparks. Partners, amounts, redemption rules and expiry are still being agreed." },
      { Icon: Clock, title: "An early-supporter window", detail: "We’re considering a window through 31 December 2026. The final deadline, qualifying purchase and full terms will be published before this program opens." },
    ].map(({ Icon, title, detail }) => <View key={title} style={{ flexDirection: "row", gap: 14, paddingVertical: 6 }}><Icon size={26} color={colors.brandDeep} /><View style={{ flex: 1, gap: 6 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink }}>{title}</Text><Text style={copy}>{detail}</Text></View></View>)}
    {q.isLoading && uid ? <ContentSkeleton rows={1} /> : q.data ? <StatusMessage kind="success" title="Your interest is saved." detail="You haven’t bought a membership or received a founding badge. We’ll show the confirmed program here when it opens." /> : <ActionButton label="I’m interested in becoming a founding member" onPress={() => void join()} pending={busy} pendingLabel="Saving…" />}
    {error ? <StatusMessage kind="error" title={error} /> : null}
    <Text style={{ ...copy, fontSize: 13 }}>Joining this interest list is free. No charge, automatic renewal, badge or coin allocation is created.</Text>
    <ActionButton tone="secondary" label="Explore Sparks" onPress={() => r.push("/wallet")} />
    <ActionButton tone="ghost" label="See independent seller offers" onPress={() => r.push("/offers")} />
  </AppShell>;
}
