import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft, Bell, CaretRight, LinkSimple, MoonStars, PencilSimple, Question, ShieldCheck, SignOut, User } from "@/components/icons";
import { MemberAvatar } from "@/components/unmask-ui/MemberAvatar";
import { fonts } from "@/constants/theme";
import { signOutEverywhere } from "@/lib/auth";
import { hapticSelect } from "@/lib/haptics";
import * as api from "@/lib/profiles/api";
import { useAppStore } from "@/lib/store";
import { youVision } from "@/lib/vision/youTheme";

const ROWS = [
  { title: "Account", sub: "Personal info, username, email, password", path: "/profile/edit", Icon: User },
  { title: "Privacy", sub: "Who can see your content, interactions and activity", path: "/settings/details?section=privacy", Icon: ShieldCheck },
  { title: "Notifications", sub: "Choose what you want to be notified about", path: "/notifications", Icon: Bell },
  { title: "Appearance", sub: "Theme, app color and display", path: "/settings/details?section=appearance", Icon: MoonStars, badge: "Light" },
  { title: "Connected accounts", sub: "Link your social accounts (TikTok, Instagram, etc.)", path: "/settings/details?section=connected", Icon: LinkSimple },
  { title: "Help & support", sub: "FAQs, contact us, report a problem", path: "/help", Icon: Question },
] as const;

export default function Settings() {
  const r = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useAppStore((s) => s.profile);
  const [busy, setBusy] = useState(false);

  const identity = useQuery({
    queryKey: ["public-identity", uid?.id],
    queryFn: () => api.identity(uid!.id),
    enabled: !!uid?.id,
  });

  const name = uid?.displayName || identity.data?.display_name || "Unmasker";
  const handle = identity.data?.handle || "you";

  return (
    <View style={{ flex: 1, backgroundColor: youVision.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", backgroundColor: youVision.card, borderBottomWidth: 1, borderBottomColor: youVision.pinkSoft }}>
        <Pressable onPress={() => r.back()} style={{ width: 44, height: 44, justifyContent: "center" }}>
          <ArrowLeft size={22} color={youVision.ink} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
        <LinearGradient colors={["#FCE4EC", "#FFF0F3", "#FFFFFF"]} style={{ borderRadius: youVision.radiusCard, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View>
            <MemberAvatar name={name} uri={identity.data?.avatar_url || undefined} size={64} claimed />
            <Pressable onPress={() => r.push("/profile/edit" as Href)} style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: youVision.maroon, alignItems: "center", justifyContent: "center" }}>
              <PencilSimple size={14} color="#FFF" />
            </Pressable>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: youVision.ink }}>{name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: youVision.muted }}>@{handle}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: youVision.muted }}>Unmasker since Jan 2025</Text>
          </View>
          <Pressable onPress={() => r.push("/profile/edit" as Href)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: youVision.radiusPill, backgroundColor: youVision.pinkSoft }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: youVision.maroon }}>Edit Profile</Text>
          </Pressable>
        </LinearGradient>

        {ROWS.map((row) => (
          <Pressable
            key={row.title}
            onPress={() => {
              hapticSelect();
              r.push(row.path as Href);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: youVision.radiusCard, backgroundColor: youVision.card }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: youVision.pinkSoft, alignItems: "center", justifyContent: "center" }}>
              <row.Icon size={20} color={youVision.maroon} weight="regular" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: youVision.ink }}>{row.title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: youVision.muted }}>{row.sub}</Text>
            </View>
            {"badge" in row && row.badge ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: youVision.pinkSoft, marginRight: 4 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: youVision.maroon }}>{row.badge}</Text>
              </View>
            ) : null}
            <CaretRight size={18} color={youVision.muted} />
          </Pressable>
        ))}

        {uid ? (
          <Pressable
            disabled={busy}
            onPress={() => {
              setBusy(true);
              void signOutEverywhere().finally(() => setBusy(false));
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: youVision.radiusCard, backgroundColor: youVision.pinkSoft }}
          >
            <SignOut size={22} color={youVision.maroon} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: youVision.maroon }}>{busy ? "Signing out…" : "Log out"}</Text>
            <CaretRight size={18} color={youVision.maroon} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}