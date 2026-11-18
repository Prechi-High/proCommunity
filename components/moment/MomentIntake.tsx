import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, Camera, UploadSimple } from "@/components/icons";
import { momentFlow } from "@/lib/moment/flowTheme";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

export function MomentIntake({
  kind,
  hasExistingDraft,
  importing,
  importError,
  onBack,
  onRecord,
  onUpload,
  onContinueDraft,
}: {
  kind: MomentKind;
  hasExistingDraft: boolean;
  importing?: boolean;
  importError?: string;
  onBack: () => void;
  onRecord: () => void;
  onUpload: () => void;
  onContinueDraft: () => void;
}) {
  const config = momentConfig(kind);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: momentFlow.ink }}>Create</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, justifyContent: "center", gap: 16, paddingBottom: 24 }}>
          <View style={{ alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 40 }}>{config.emoji}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: momentFlow.ink, textAlign: "center" }}>{config.title}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: momentFlow.muted, textAlign: "center", lineHeight: 22 }}>{config.tagline}</Text>
          </View>

          <Pressable
            onPress={() => {
              hapticSelect();
              onRecord();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 18,
              borderRadius: momentFlow.radiusCard,
              backgroundColor: momentFlow.accent,
            }}
          >
            <Camera size={24} color="#FFF8F4" weight="fill" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: "#FFF8F4" }}>Record in Unmask</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: "rgba(255,248,244,0.85)" }}>Use the creator camera and studio tools</Text>
            </View>
          </Pressable>

          <Pressable
            disabled={importing}
            onPress={() => {
              hapticSelect();
              onUpload();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 18,
              borderRadius: momentFlow.radiusCard,
              backgroundColor: momentFlow.card,
              borderWidth: 1.5,
              borderColor: momentFlow.accent,
            }}
          >
            <UploadSimple size={24} color={momentFlow.accent} weight="bold" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: momentFlow.ink }}>{importing ? "Opening library…" : "Upload from device"}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>Pick a video or photo from your library</Text>
            </View>
          </Pressable>

          {hasExistingDraft ? (
            <Pressable
              onPress={() => {
                hapticSelect();
                onContinueDraft();
              }}
              style={{
                padding: 16,
                borderRadius: momentFlow.radiusPill,
                alignItems: "center",
                borderWidth: 1,
                borderColor: momentFlow.accentSoft,
                backgroundColor: momentFlow.pillPink,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>Continue draft</Text>
            </Pressable>
          ) : null}

          {importError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.warnInk, textAlign: "center" }}>{importError}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}