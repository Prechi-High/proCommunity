import { Text, View } from "react-native";

import { fonts } from "@/constants/theme";
import { momentFlow } from "@/lib/moment/flowTheme";

const STEPS = [
  { id: "capture", label: "Capture" },
  { id: "compose", label: "Compose" },
  { id: "preview", label: "Preview" },
] as const;

export function MomentStepper({
  active,
}: {
  active: "capture" | "compose" | "preview";
}) {
  const activeIdx = STEPS.findIndex((s) => s.id === active);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 0, paddingHorizontal: 12, paddingVertical: 10 }}>
      {STEPS.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <View key={step.id} style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={{ alignItems: "center", flex: 1, gap: 6 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done || current ? momentFlow.accent : "#E8D5D5",
                }}
              >
                {done ? (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: "#FFF8F4" }}>✓</Text>
                ) : (
                  <View
                    style={{
                      width: current ? 10 : 8,
                      height: current ? 10 : 8,
                      borderRadius: 5,
                      backgroundColor: current ? "#FFF8F4" : "#C9B0B0",
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontFamily: current ? fonts.semibold : fonts.medium,
                  fontSize: 12,
                  color: current || done ? momentFlow.accent : momentFlow.muted,
                }}
              >
                {step.label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? (
              <View
                style={{
                  position: "absolute",
                  right: -1,
                  top: 10,
                  width: "50%",
                  height: 2,
                  backgroundColor: i < activeIdx ? momentFlow.accent : "#E8D5D5",
                  alignSelf: "center",
                  marginLeft: "50%",
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
