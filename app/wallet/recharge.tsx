import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppShell, ActionButton, FilterChips } from "@/components/unmask-ui";
import { MonthlySparkCard } from "@/components/home/MonthlySparkCard";
import { Lightning, Check, Lock } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
export default function Recharge() {
  const r = useRouter();
  const [kind, setKind] = useState("Sparks"), [amount, setAmount] = useState(100);
  const thunder = kind === "Thunder Sparks", price = amount * (thunder ? 1000 : 10);
  return <AppShell back navigation title="A little extra Spark." subtitle="Support the stories you want answers to.">
    <MonthlySparkCard />
    <FilterChips options={["Sparks", "Thunder Sparks"]} value={kind} onChange={value => { setKind(value); setAmount(value === "Sparks" ? 100 : 1); }} />
    <Text style={{ fontFamily: fonts.semibold, fontSize: 21, color: colors.ink }}>Choose your pack.</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {(thunder ? [1,5,10] : [50,100,500,1000]).map(n => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: amount === n }} accessibilityLabel={`${n} ${kind}, ₦${(n*(thunder?1000:10)).toLocaleString()}`} onPress={() => { hapticSelect(); setAmount(n); }} style={({ pressed }) => ({ flexGrow: 1, flexBasis: "42%", minWidth: 125, padding: 20, borderRadius: 23, borderWidth: 1.5, borderColor: amount === n ? colors.brandDeep : colors.line, backgroundColor: amount === n ? "#F6EAF0" : "#F9F6F3", gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Lightning size={26} color={amount === n ? colors.brandDeep : "#967247"} weight={thunder ? "fill" : "regular"} />{amount === n ? <Check size={20} color={colors.brandDeep} /> : null}</View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 29, color: colors.ink }}>{n.toLocaleString()}</Text><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft }}>{kind}</Text><Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}>₦{(n*(thunder?1000:10)).toLocaleString()}</Text>
      </Pressable>)}
    </View>
    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.inkSoft }}>1 Spark = ₦10. 1 Thunder Spark = 100 Sparks of support. Sparks support a closer look, not a particular finding.</Text>
    <LinearGradient colors={["#4D2033", "#2B1020"]} style={{ padding: 22, borderRadius: 25, gap: 13 }}><Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, color: "#EACD8D" }}>YOUR CHOSEN PACK</Text><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: "#fff" }}>{amount.toLocaleString()} {kind}</Text><Text style={{ fontFamily: fonts.semibold, fontSize: 25, color: "#fff" }}>₦{price.toLocaleString()}</Text></View></LinearGradient>
    <View style={{ padding: 18, borderRadius: 20, backgroundColor: "#F5F1ED", flexDirection: "row", gap: 11 }}><Lock size={21} color={colors.brandDeep} /><Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.inkSoft }}>Checkout is coming soon. No payment can be taken yet. You can still claim your free monthly Sparks above.</Text></View>
    <ActionButton label="Checkout opens soon" disabled onPress={() => {}} />
    <ActionButton tone="ghost" label="Back to my wallet" onPress={() => r.replace("/wallet")} />
  </AppShell>;
}
