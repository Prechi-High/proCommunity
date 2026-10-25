import { Text, View } from "react-native";
import { ChatCircle, Sparkle } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
export function ClarityLayers() {
  return (
    <View style={{ gap: 12, paddingVertical: 8 }}>
      {[
        {
          title: "Real people. Real experiences.",
          body: "Ask the community and see how products worked over time.",
          Icon: ChatCircle,
          bg: "#EDF2EC",
          fg: "#365D41",
        },
        {
          title: "A closer look. Together.",
          body: "Spark an Ultra Unmask. A creator can explore the question behind your story.",
          Icon: Sparkle,
          bg: "#F5E9DC",
          fg: "#865B17",
        },
      ].map(({ title, body, Icon, bg, fg }) => (
        <View
          key={title}
          style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={23} color={fg} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                color: colors.ink,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                lineHeight: 21,
                color: colors.inkSoft,
              }}
            >
              {body}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
