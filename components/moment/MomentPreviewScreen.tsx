import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ArrowLeft,
  InstagramLogo,
  NotePencil,
  PencilSimple,
  Waveform,
  TiktokLogo,
  WhatsappLogo,
} from "@/components/icons";
import { CreatorToolSheets, type CreatorToolKind } from "@/components/moment/CreatorToolSheets";
import { MomentStepper } from "@/components/moment/MomentStepper";
import { UnmaskMomentCard } from "@/components/moment/UnmaskMomentCard";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import type { MomentKind } from "@/lib/moment/kinds";
import type { CreatorSettings, MomentAudience, MomentContext } from "@/lib/moment/types";
import { useState } from "react";

/**
 * Preview — the merged Unmask card (exact look for status + export) + publish/share.
 */
export function MomentPreviewScreen({
  kind,
  productStory,
  mediaUri,
  mediaKind,
  posterUri,
  context,
  caption,
  creator,
  audience,
  processing,
  processingLabel,
  onCreatorChange,
  onAudienceChange,
  onBack,
  onEditCompose,
  onPublish,
  onShareOutside,
  publishing,
}: {
  kind: MomentKind;
  productStory?: boolean;
  mediaUri: string;
  mediaKind: "photo" | "video";
  posterUri?: string;
  context: MomentContext;
  caption: string;
  creator: CreatorSettings;
  audience: MomentAudience;
  processing?: boolean;
  processingLabel?: string;
  onCreatorChange: (c: CreatorSettings) => void;
  onAudienceChange: (a: MomentAudience) => void;
  onBack: () => void;
  onEditCompose: () => void;
  onPublish: () => void;
  onShareOutside: () => void;
  publishing?: boolean;
}) {
  const [toolOpen, setToolOpen] = useState<CreatorToolKind>(null);
  const [audienceOpen, setAudienceOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: momentFlow.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 20, color: momentFlow.ink }}>Unmask</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={{ textAlign: "center", fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.muted, marginBottom: 4 }}>Preview</Text>
        <MomentStepper active="preview" />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: momentFlow.ink }}>Your Unmask is ready ✨</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: momentFlow.muted }}>
            Here’s how it will look when you share it.
          </Text>
        </View>

        <UnmaskMomentCard
          kind={kind}
          productStory={productStory}
          mediaUri={mediaUri}
          mediaKind={mediaKind}
          posterUri={posterUri}
          context={context}
          caption={caption}
          playing
        />

        {processing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <ActivityIndicator color={momentFlow.accent} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: momentFlow.muted }}>
              {processingLabel || "Creating your Unmask…"}
            </Text>
          </View>
        ) : null}

        {/* Edit ribbon */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
          {[
            { label: "Edit", Icon: PencilSimple, onPress: onEditCompose },
            {
              label: "Music",
              Icon: Waveform,
              onPress: () => {
                if (mediaKind === "photo") setToolOpen("music");
              },
            },
            { label: "Text", Icon: NotePencil, onPress: onEditCompose },
            { label: "Slides", Icon: PencilSimple, onPress: onEditCompose },
          ].map(({ label, Icon, onPress }) => (
            <Pressable
              key={label}
              onPress={() => {
                hapticSelect();
                onPress();
              }}
              style={{ alignItems: "center", gap: 6, width: 64 }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: momentFlow.card,
                  borderWidth: 1,
                  borderColor: momentFlow.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={20} color={momentFlow.accent} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: momentFlow.muted }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setAudienceOpen((v) => !v)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
            borderRadius: 16,
            backgroundColor: momentFlow.card,
            borderWidth: 1,
            borderColor: momentFlow.accentSoft,
          }}
        >
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Who can see this Unmask?</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: momentFlow.muted, marginRight: 6 }}>
            {audience === "everyone" ? "Everyone" : audience === "followers" ? "Followers" : "Only me"}
          </Text>
        </Pressable>
        {audienceOpen ? (
          <View style={{ gap: 8 }}>
            {(
              [
                ["everyone", "Everyone"],
                ["followers", "My Followers"],
                ["private", "Only Me"],
              ] as const
            ).map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => {
                  hapticSelect();
                  onAudienceChange(id);
                  setAudienceOpen(false);
                }}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: audience === id ? momentFlow.pillPink : momentFlow.card,
                  borderWidth: 1,
                  borderColor: audience === id ? momentFlow.accent : momentFlow.accentSoft,
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, color: audience === id ? momentFlow.accent : momentFlow.ink }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          disabled={publishing || processing}
          onPress={() => {
            hapticSelect();
            onPublish();
          }}
          style={{
            paddingVertical: 16,
            borderRadius: momentFlow.radiusPill,
            backgroundColor: publishing ? momentFlow.muted : "#C94B6A",
            alignItems: "center",
          }}
        >
          {publishing ? (
            <ActivityIndicator color="#FFF8F4" />
          ) : (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Publish to Unmask</Text>
          )}
        </Pressable>

        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.muted, textAlign: "center" }}>Also share to</Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, paddingBottom: 12 }}>
          {[
            { Icon: InstagramLogo, color: "#E1306C" },
            { Icon: TiktokLogo, color: "#111" },
            { Icon: WhatsappLogo, color: "#25D366" },
          ].map(({ Icon, color }, i) => (
            <Pressable
              key={i}
              onPress={() => {
                hapticSelect();
                onShareOutside();
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: momentFlow.card,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: momentFlow.accentSoft,
              }}
            >
              <Icon size={26} color={color} weight="fill" />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <CreatorToolSheets open={toolOpen} creator={creator} onClose={() => setToolOpen(null)} onChange={onCreatorChange} mediaKind={mediaKind} />
    </View>
  );
}
