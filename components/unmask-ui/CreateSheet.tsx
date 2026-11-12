import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  Camera,
  CaretRight,
  ChatCircle,
  Package,
  PencilSimple,
} from "@/components/icons";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { features } from "@/lib/features";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";

import { ActionSheet } from "./ActionSheet";

const ACTIONS = [
  {
    label: "Share your moment",
    detail: "Camera, glow, story or post.",
    href: "/moment",
    Icon: Camera,
    colors: ["#3D0F15", "#8E4052"] as const,
  },
  {
    label: COPY.createExperience,
    detail: "What changed, in your words.",
    href: "/contribute",
    Icon: PencilSimple,
    colors: ["#236044", "#3D0F15"] as const,
  },
  {
    label: COPY.createQuestion,
    detail: "Ask people who tried it.",
    href: "/ask-community",
    Icon: ChatCircle,
    colors: ["#5C2834", "#C9A227"] as const,
  },
  {
    label: COPY.createTrack,
    detail: "A timeline you can pin later.",
    href: "/products/add",
    Icon: Package,
    colors: ["#1A0A14", "#70323E"] as const,
  },
] as const;

export function CreateSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const signedIn = Boolean(uid);
  const creator = useQuery({ queryKey: ["my-creator", uid], queryFn: async () => { const { data } = await db().from("unmask_creators").select("user_id").eq("user_id", uid!).maybeSingle(); return data; }, enabled: features.creatorStudio && !!uid });
  return (
    <ActionSheet
      open={open}
      title="What would you like to do?"
      onClose={onClose}
    >
      <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginTop: -4 }}>
        Pick a way in. The big one is a moment — camera, look, then post or story.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {ACTIONS.map(({ label, detail, href, Icon, colors: gradient }) => (
          <Pressable
            key={href}
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              onClose();
              if (!signedIn) {
                router.push({ pathname: "/(auth)/sign-in", params: { returnTo: href } } as Href);
                return;
              }
              router.push(href as Href);
            }}
            style={{ width: "48%", minHeight: 132, borderRadius: 22, overflow: "hidden" }}
          >
            <LinearGradient colors={[...gradient]} style={{ flex: 1, padding: 14, justifyContent: "space-between", gap: 8 }}>
              <Icon size={26} color="#FFF8F4" />
              <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: "#FFF8F4" }}>{label}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: "rgba(255,248,244,0.78)" }}>{detail}</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </View>
      {signedIn && features.creatorStudio ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => { hapticSelect(); onClose(); router.push((creator.data ? "/creator-studio" : "/creator-program") as Href); }}
          style={{ flexDirection: "row", gap: 14, alignItems: "center", minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, borderRadius: 18, backgroundColor: "#F3EBE2" }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
            <ChatCircle size={22} color={colors.brandDeep} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink }}>{creator.data ? "Creator Studio" : "Creator Program"}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>{creator.data ? "Go live, open a Room or manage your creator identity." : "Apply to join the Unmask creator network."}</Text>
          </View>
          <CaretRight size={16} color={colors.bone3} />
        </Pressable>
      ) : null}
    </ActionSheet>
  );
}
