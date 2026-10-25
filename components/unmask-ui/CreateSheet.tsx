import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  CaretRight,
  ChatCircle,
  Package,
  PencilSimple,
} from "@/components/icons";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { useAppStore } from "@/lib/store";

import { ActionSheet } from "./ActionSheet";

const ACTIONS = [
  {
    label: COPY.createExperience,
    detail: "Good or bad. Keep updating it as it changes.",
    href: "/contribute",
    Icon: PencilSimple,
  },
  {
    label: COPY.createQuestion,
    detail: "Hear from people who have tried it.",
    href: "/ask-community",
    Icon: ChatCircle,
  },
  {
    label: COPY.createTrack,
    detail: "Add photos and updates. Share only when you choose.",
    href: "/products/add",
    Icon: Package,
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
  const signedIn = Boolean(useAppStore((s) => s.profile?.id));
  return (
    <ActionSheet
      open={open}
      title="What would you like to do?"
      onClose={onClose}
    >
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 15,
          lineHeight: 22,
          color: colors.inkSoft,
          marginTop: -4,
        }}
      >
        Share a story, find an answer, or keep a private product diary.
      </Text>
      <View
        style={{
          backgroundColor: colors.stage,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {ACTIONS.map(({ label, detail, href, Icon }, i) => (
          <Pressable
            key={href}
            accessibilityRole="button"
            onPress={() => {
              hapticSelect();
              onClose();
              if (!signedIn) {
                router.push({
                  pathname: "/(auth)/sign-in",
                  params: { returnTo: href },
                } as Href);
                return;
              }
              router.push(href as Href);
            }}
            style={{
              flexDirection: "row",
              gap: 14,
              alignItems: "center",
              minHeight: 76,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: colors.line,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={22} color={colors.brandDeep} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 16,
                  lineHeight: 22,
                  color: colors.ink,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.inkSoft,
                }}
              >
                {detail}
              </Text>
            </View>
            <CaretRight size={16} color={colors.bone3} />
          </Pressable>
        ))}
      </View>
    </ActionSheet>
  );
}
