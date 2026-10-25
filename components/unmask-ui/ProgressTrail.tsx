import { Text, View } from "react-native";
import { ChatCircle, Sparkle, User, Play, Check } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import type { PublicUnmaskStage } from "@/lib/unmask/status";
export function ProgressTrail({ stage }: { stage: PublicUnmaskStage }) {
  const stages = ["open", "picked", "making", "unmasked"];
  const current = stages.indexOf(stage);
  if (current < 0) return null;
  return (
    <View
      accessibilityLabel={`Ultra Unmask progress: ${["Open for support", "Creator assigned", "In the making", "Answer published"][current]}`}
      style={{
        padding: 18,
        borderRadius: 22,
        backgroundColor: "#F5EFEA",
        gap: 16,
      }}
    >
      {[
        {
          title: "A question worth asking",
          detail: "Open for community support",
          Icon: ChatCircle,
        },
        {
          title: "A creator picks it up",
          detail: "Your story has an assigned creator",
          Icon: User,
        },
        {
          title: "Taking a closer look",
          detail: "Gathering experiences and context",
          Icon: Sparkle,
        },
        {
          title: "Sharing what we found",
          detail: "The published Ultra Unmask",
          Icon: Play,
        },
      ].map(({ title, detail, Icon }, i) => (
        <View
          key={title}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            opacity: i > current ? 0.55 : 1,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: i <= current ? colors.brandDeep : "#E5DCD6",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i < current ? (
              <Check size={18} color="#fff" />
            ) : (
              <Icon
                size={18}
                color={i === current ? "#F2DA9D" : colors.inkSoft}
              />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 14,
                color: colors.ink,
              }}
            >
              {title}
            </Text>
            {i === current ? (
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 13,
                  color: colors.inkSoft,
                }}
              >
                {detail}
              </Text>
            ) : null}
          </View>
          {i === current ? (
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 7,
                backgroundColor: "#EADFD7",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 11,
                  color: colors.brand,
                }}
              >
                Now
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
