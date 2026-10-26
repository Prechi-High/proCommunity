import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Lightning } from "@/components/icons";
import { colors, fonts } from "@/constants/theme";
import { sparkProgress } from "@/lib/unmask/status";
export function SparkMeter({
  weight = 0,
  goal,
  compact,
}: {
  weight?: number;
  goal?: number;
  compact?: boolean;
}) {
  const p = sparkProgress(weight, goal);
  const size = compact ? 60 : 92;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Community Spark support"
      accessibilityValue={{
        min: 0,
        max: p.goal,
        now: Math.min(p.weight, p.goal),
        text: `${p.weight} of ${p.goal} Sparks`,
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 12 : 18,
        padding: compact ? 12 : 18,
        borderRadius: 20,
        backgroundColor: p.ready ? "#F8E8B7" : "#F8F0E4",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E7DBC9"
            strokeWidth={6}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={p.ready ? "#9C6A08" : colors.brand}
            strokeWidth={6}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - p.ratio)}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <Lightning
          size={compact ? 22 : 32}
          weight="fill"
          color={p.ready ? "#9C6A08" : colors.brand}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: compact ? 18 : 26,
            color: colors.ink,
          }}
        >
          {p.weight.toLocaleString()} Sparks
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 12,
            lineHeight: 18,
            color: colors.inkSoft,
          }}
        >
          {p.ready
            ? "Target reached · team review is next"
            : `${p.remaining.toLocaleString()} to the ${p.goal.toLocaleString()} target`}
        </Text>
        {!compact ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              lineHeight: 19,
              color: colors.inkSoft,
            }}
          >
            You’re helping put this question in front of a creator. Sparks never
            buy a conclusion.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
