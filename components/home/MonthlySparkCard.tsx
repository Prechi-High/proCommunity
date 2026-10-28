import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { ActionButton, Skeleton, StatusMessage } from "@/components/unmask-ui";
import { Lightning, Sparkle, Check } from "@/components/icons";
import { monthlySparks } from "@/lib/membership";
import { wallet } from "@/lib/investigations/api";
import { useAppStore } from "@/lib/store";
import { hapticSuccess } from "@/lib/haptics";
import { colors, fonts } from "@/constants/theme";

function Particle({ index, fire }: { index: number; fire: number }) {
  const progress = useSharedValue(1), reduced = useReducedMotion();
  useEffect(() => { if (fire) { progress.value = 0; progress.value = withTiming(1, { duration: reduced ? 200 : 950 }); } }, [fire, progress, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: fire ? 1 - progress.value : 0, transform: [
    { translateX: reduced ? 0 : Math.cos(index * Math.PI / 4) * 90 * progress.value },
    { translateY: reduced ? 0 : Math.sin(index * Math.PI / 4) * 70 * progress.value },
    { scale: 1 - progress.value * 0.5 },
  ] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 28, left: 28 }, style]}><Sparkle size={15} color={index % 2 ? "#9E3E63" : "#B38320"} weight="fill" /></Animated.View>;
}
export function MonthlySparkCard() {
  const uid = useAppStore(s => s.profile?.id), r = useRouter(), qc = useQueryClient();
  const grant = useQuery({ queryKey: ["monthly-sparks", uid], queryFn: () => monthlySparks(), enabled: !!uid, staleTime: 30000 });
  const balance = useQuery({ queryKey: ["spark-wallet", uid], queryFn: wallet, enabled: !!uid });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [fire, setFire] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    if (!uid || !grant.data) return;
    const timer = setInterval(() => { if (Date.now() >= Date.parse(grant.data!.next_claim_at)) void grant.refetch(); }, 60000);
    return () => clearInterval(timer);
  }, [uid, grant.data?.next_claim_at]);
  const next = grant.data ? new Date(grant.data.next_claim_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "next month";
  async function claim() {
    if (!uid) { r.push({ pathname: "/(auth)/sign-in", params: { returnTo: "/" } } as Href); return; }
    if (saving.current || grant.isLoading || grant.isError || grant.data?.claimed) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const receipt = await monthlySparks(true);
      qc.setQueryData(["monthly-sparks", uid], receipt);
      qc.setQueryData(["spark-wallet", uid], (old: {sparks:number;thunder:number} | null | undefined) => old ? ({ ...old, sparks: receipt.sparks }) : old);
      if (receipt.awarded) { setFire(n => n + 1); hapticSuccess(); }
      void qc.invalidateQueries({ queryKey: ["spark-wallet", uid] });
    } catch { setError("Your Sparks couldn’t be claimed. Try again—we’ll never grant the same month twice."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <LinearGradient colors={["#FFF2CC", "#F7E8C8", "#F4E8DA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, borderRadius: 26, gap: 14, borderWidth: 1, borderColor: "#EEDDB7" }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 65, height: 65, borderRadius: 23, backgroundColor: "#FFF9E9", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] }}>
        <Lightning size={36} weight="fill" color={colors.brandDeep} />
        {Array.from({ length: 8 }, (_, i) => <Particle key={i} index={i} fire={fire} />)}
      </View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.4, color: "#795A2D" }}>YOUR MONTHLY SPARK DROP</Text>
        {uid && grant.isLoading ? <Skeleton height={29} width={160} /> : <Text accessibilityRole="header" style={{ fontFamily: fonts.semibold, fontSize: 23, lineHeight: 28, letterSpacing: -0.5, color: colors.ink }}>{fire ? "+50 Sparks. You’re charged." : grant.data?.claimed ? "This month? Claimed." : "50 Sparks. On us."}</Text>}
      </View>
    </View>
    <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: "#6C5641" }}>{grant.data?.claimed ? `Your next free 50 are ready on ${next}. Recharge whenever you need more.` : "A little fuel for the stories you want answers to. Claim your free 50 every month."}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <View style={{ flex: 1, minWidth: 160 }}>{grant.isError ? <ActionButton label="Retry monthly Sparks" tone="secondary" onPress={() => void grant.refetch()} /> : <ActionButton label={!uid ? "Sign in & claim 50 Sparks" : grant.data?.claimed ? "Recharge Sparks" : "Claim my 50 Sparks"} pending={busy} pendingLabel="Claiming…" disabled={!!uid && grant.isLoading} onPress={grant.data?.claimed ? () => r.push("/wallet/recharge") : () => void claim()} icon={grant.data?.claimed ? <Check size={18} color="#fff" /> : <Lightning size={18} color="#fff" />} />}</View>
      <View style={{ gap: 3, minWidth: 95 }}><Text style={{ fontFamily: fonts.medium, fontSize: 10, color: "#795A2D", letterSpacing: 0.7 }}>YOUR BALANCE</Text>{uid && balance.isLoading ? <Skeleton width={75} height={20} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}>{!uid ? "Sign in to see" : balance.isError ? "Unavailable" : `${(balance.data?.sparks ?? 0).toLocaleString()} Sparks`}</Text>}</View>
    </View>
    <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: "#7E674D" }}>Once per calendar month · Lagos time. Unclaimed drops don’t stack. Claimed Sparks stay in your wallet.</Text>
    {error ? <StatusMessage kind="error" title="Not claimed yet" detail={error} /> : null}
  </LinearGradient>;
}
