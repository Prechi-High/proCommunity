import { CheckCircle, Warning, Info, Clock } from "@/components/icons";
import { Text, View } from "react-native";

import { colors, fonts, radii } from "@/constants/theme";

type Kind = "info" | "success" | "error" | "pending";

const STYLES: Record<Kind, { bg: string; fg: string; bar: string }> = {
  info: { bg: colors.mist, fg: colors.ink, bar: colors.brand },
  success: { bg: colors.sageSoft, fg: colors.sageInk, bar: colors.sage },
  error: { bg: colors.coralSoft, fg: colors.coral, bar: colors.coral },
  pending: { bg: colors.goldSoft, fg: colors.honeyInk, bar: colors.gold },
};

export function StatusMessage({
  kind = "info",
  title,
  detail,
}: {
  kind?: Kind;
  title: string;
  detail?: string;
}) {
  const s = STYLES[kind];
  const Icon =
    kind === "success"
      ? CheckCircle
      : kind === "error"
        ? Warning
        : kind === "pending"
          ? Clock
          : Info;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      style={{
        backgroundColor: s.bg,
        borderRadius: radii.notice,
        padding: 16,
        paddingLeft: 14,
        gap: 4,
        flexDirection: "row",
      }}
    >
      <Icon size={22} color={s.fg} style={{ marginRight: 10 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 15,
            lineHeight: 20,
            color: s.fg,
          }}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 20,
              color: s.fg,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
