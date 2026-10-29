import { Text, View } from "react-native";
import { colors, fonts } from "@/constants/theme";

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function CreatorMark({
  mark = "creator",
  size = 42,
  label = false,
}: {
  mark?: string | null;
  size?: number;
  label?: boolean;
}) {
  const h = hash(mark || "creator");
  const rotation = (h % 24) - 12;
  const inset = Math.round(size * 0.23);
  const code = (mark || "creator").replace(/^creator[-_]?/, "").slice(0, 3).toUpperCase() || "U";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        accessibilityLabel={label ? `Unmask Creator mark ${code}` : undefined}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: colors.brandDeep,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: size - inset * 2,
            height: size - inset * 2,
            borderWidth: Math.max(1, Math.round(size * 0.055)),
            borderColor: "#F2D25B",
            borderRadius: size * 0.22,
            transform: [{ rotate: `${rotation}deg` }],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size,
              backgroundColor: "#F2D25B",
              transform: [{ rotate: `${-rotation * 1.6}deg` }],
            }}
          />
          <View
            style={{
              position: "absolute",
              width: size * 0.62,
              height: size * 0.16,
              borderRadius: size,
              borderWidth: 1,
              borderColor: "#F3EBE2",
              transform: [{ rotate: "45deg" }],
            }}
          />
        </View>
      </View>
      {label ? (
        <View style={{ gap: 1 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: colors.brandDeep }}>
            UNMASK CREATOR
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>
            {code}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
