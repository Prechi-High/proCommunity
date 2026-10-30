import { Pressable, Text, View } from "react-native";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { User, Lock, Bell, Lightning, ChatCircle, Info, CaretRight, MoonStars } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { UtilityPage } from "@/components/utilities/Page";
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
} from "@/components/unmask/reference/ui";
import { useAppStore } from "@/lib/store";
import { signOutEverywhere } from "@/lib/auth";
const groups = [
  {
    title: "Account",
    rows: [
      [
        "Interests & optional context",
        "Update your private setup",
        "/onboarding/interests",
      ],
      ["Profile", "Manage your profile and preferences", "/profile/edit"],
      [
        "Sign-in and security",
        "Your sign-in details and account access",
        "/settings/details?section=security",
      ],
    ],
  },
  {
    title: "Appearance",
    rows: [
      ["Theme", "Light, dark, or follow your device", "/settings/details?section=appearance"],
    ],
  },
  {
    title: "Privacy",
    rows: [
      [
        "Personal product context",
        "Control the context you choose to share",
        "/clarity-settings",
      ],
      [
        "Public profile visibility",
        "Manage what others can see",
        "/profile/edit",
      ],
      [
        "Data controls",
        "Manage data on this device",
        "/settings/details?section=data",
      ],
    ],
  },
  {
    title: "Notifications",
    rows: [
      [
        "Investigation updates",
        "Manage followed investigation updates",
        "/settings/details?section=notifications",
      ],
      ["Replies and follows", "View your community updates", "/notifications"],
      [
        "Offers notifications",
        "Availability and preferences",
        "/settings/details?section=offers",
      ],
    ],
  },
  {
    title: "Payments",
    rows: [
      [
        "Purchase history",
        "Past recharge purchases and receipts (₦)",
        "/wallet/purchases",
      ],
      [
        "Contributions",
        "Your recorded investigation support",
        "/wallet/history",
      ],
    ],
  },
  {
    title: "Support",
    rows: [
      ["Help and support", "Find answers or send a support request", "/help"],
    ],
  },
  {
    title: "About",
    rows: [
      [
        "Terms",
        "Terms of service availability",
        "/settings/details?section=terms",
      ],
      [
        "Privacy policy",
        "Privacy policy availability",
        "/settings/details?section=privacy",
      ],
    ],
  },
];
export default function Settings() {
  const r = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <AppShell back navigation title="Settings" subtitle="Your account. Your choices.">
      {groups.map((g) => {
        const Icon = g.title === "Account" ? User : g.title === "Privacy" ? Lock : g.title === "Appearance" ? MoonStars : g.title === "Notifications" ? Bell : g.title === "Support" ? ChatCircle : g.title === "About" ? Info : Lightning;
        return <View key={g.title} style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft, paddingHorizontal: 5 }}>{g.title}</Text>
          <View style={{ borderRadius: 23, overflow: "hidden", backgroundColor: "#F6F2EF" }}>
            {g.rows.map(([label, sub, path], i) => <Pressable key={label} accessibilityRole="link" onPress={() => { hapticSelect(); r.push(path as Href); }} style={({ pressed }) => ({ padding: 17, minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: pressed ? "#EDE4E8" : "transparent", borderBottomWidth: i === g.rows.length-1 ? 0 : 1, borderColor: "#E9E0DB" })}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#EDE3E7", alignItems: "center", justifyContent: "center" }}><Icon size={19} color={colors.brandDeep} /></View>
              <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}>{label}</Text><Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.inkSoft }}>{sub}</Text></View><CaretRight size={18} color={colors.inkSoft} />
            </Pressable>)}
          </View>
        </View>;
      })}
      {error ? <StatusMessage kind="error" title={error} /> : null}
      {uid ? (
        <ActionButton
          tone="secondary"
          disabled={busy}
          label={busy ? "Signing out…" : "Sign out →"}
          onPress={() => {
            setBusy(true);
            void signOutEverywhere()
              .catch(() => setError("Could not sign out. Please retry."))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </AppShell>
  );
}
