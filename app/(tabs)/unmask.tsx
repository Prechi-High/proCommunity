import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppShell, ActionButton, SearchField } from "@/components/unmask-ui";
import { Camera, ChatCircle, Play, ArrowRight, Scan } from "@/components/icons";
import { useScan } from "@/lib/useScan";
import { colors, fonts } from "@/constants/theme";

const body = { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft };

export default function UnmaskHub() {
  const router = useRouter();
  const scan = useScan();
  const [q, setQ] = useState("");
  function search() { const value = q.trim(); if (value.length > 1) router.push({ pathname: "/results", params: { q: value } } as Href); }
  return (
    <AppShell notify title="Unmask" subtitle="Know before you buy.">
      <View style={{ gap: 14 }}>
        <View style={{ gap: 9 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 30, lineHeight: 35, color: colors.ink }}>Find the truth behind a product.</Text>
          <Text style={body}>Search a product, scan it, explore what people found, or take a specific situation further.</Text>
        </View>
        <View style={{ padding: 18, borderRadius: 25, backgroundColor: "#F6F3F1", borderWidth: 1, borderColor: "#EEE7E1", gap: 12 }}>
          <SearchField value={q} onChange={setQ} onSubmit={search} onCamera={scan.openCamera} placeholder="Which product should we unmask?" />
          {q.trim().length > 1 ? <ActionButton label="Unmask this product" icon={<ArrowRight size={18} color="#fff" />} onPress={search} /> : null}
          <Pressable accessibilityRole="button" onPress={scan.openCamera} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Camera size={18} color={colors.brandDeep} /><Text style={{ fontFamily: fonts.medium, color: colors.brandDeep }}>Scan a product instead</Text>
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 19, color: colors.ink, marginTop: 8 }}>Three ways in</Text>
        {[
          { icon: Play, title: "Live", detail: "Watch an Unmask Creator investigate products in real time. Ask questions and discover what matters.", action: "Enter Live", href: "/live" },
          { icon: ChatCircle, title: "Room", detail: "Join an audio-first discussion. Listen, ask to speak, and learn from other people's experiences.", action: "Enter Room", href: "/room" },
          { icon: Scan, title: "Ultra", detail: "Have a specific situation? Combine your context, AI research, evidence and a creator's judgment.", action: "Explore Ultra", href: "/ultra-unmask" },
        ].map(({ icon: Icon, title, detail, action, href }) => (
          <View key={title} style={{ padding: 19, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EDE6E1", gap: 11 }}>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#F3EBE2", alignItems: "center", justifyContent: "center" }}><Icon size={22} color={colors.brandDeep} /></View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 21, color: colors.ink }}>{title}</Text>
            <Text style={body}>{detail}</Text>
            <ActionButton tone="secondary" label={action} onPress={() => router.push(href as Href)} />
          </View>
        ))}
      </View>
      {scan.sheet}
    </AppShell>
  );
}
