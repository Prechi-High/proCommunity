import { ChatCircle, Sparkle } from "@/components/icons";
import { Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";

import { ActionButton } from "./ActionButton";

export function EmptyState({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        gap: 12,
        paddingVertical: 24,
        paddingHorizontal: 8,
        alignItems: "flex-start",
      }}
    >
      <View style={{ width: 76, height: 68, marginBottom: 8 }}>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 22,
            backgroundColor: "#F2E8EB",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChatCircle size={32} color={colors.brand} />
        </View>
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            padding: 6,
            borderRadius: 12,
            backgroundColor: "#F4E2AD",
          }}
        >
          <Sparkle size={18} color="#805B15" />
        </View>
      </View>
      <Text
        style={{
          fontFamily: fonts.serifBold,
          fontSize: 25,
          lineHeight: 30,
          color: colors.ink,
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 24,
            color: colors.inkSoft,
          }}
        >
          {detail}
        </Text>
      ) : null}
      {action && onAction ? (
        <View style={{ width: "100%", paddingTop: 8 }}>
          <ActionButton label={action} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
