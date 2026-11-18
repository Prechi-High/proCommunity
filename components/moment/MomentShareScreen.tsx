import { Image, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, InstagramLogo, Sparkle, TiktokLogo, WhatsappLogo } from "@/components/icons";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";

import type { MomentContext } from "./MomentComplete";

export function MomentShareScreen({
  kind,
  mediaUri,
  context,
  onBack,
  onPublish,
  saveToJourney,
  onToggleJourney,
}: {
  kind: MomentKind;
  mediaUri: string;
  context: MomentContext;
  onBack: () => void;
  onPublish: () => void;
  saveToJourney: boolean;
  onToggleJourney: (v: boolean) => void;
}) {
  const config = momentConfig(kind);
  const title = `${config.title} ${config.emoji} ${context.occasion ? `· ${context.occasion}` : ""}`.trim();
  const products = context.products?.length || (context.productName ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: momentFlow.ink }}>Share your Unmask</Text>
            <Sparkle size={20} color={momentFlow.accent} weight="fill" />
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: momentFlow.muted }}>
            Your moment will appear in Updates and your profile. Choose who can see it.
          </Text>
        </View>

        <View
          style={{
            marginHorizontal: 20,
            flexDirection: "row",
            gap: 14,
            padding: 14,
            borderRadius: momentFlow.radiusCard,
            backgroundColor: momentFlow.card,
            borderWidth: 1,
            borderColor: momentFlow.accentSoft,
          }}
        >
          <Image source={{ uri: mediaUri }} style={{ width: 64, height: 88, borderRadius: 12 }} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: momentFlow.ink }}>{title}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>
              My routine + {products || 6} products
            </Text>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, marginTop: 20, borderRadius: momentFlow.radiusCard, backgroundColor: momentFlow.card, overflow: "hidden" }}>
          <Pressable style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Audience</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: momentFlow.muted }}>Everyone ›</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Save to Product Journey</Text>
            <Switch value={saveToJourney} onValueChange={onToggleJourney} trackColor={{ true: momentFlow.accent, false: momentFlow.accentSoft }} />
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => {
            hapticSelect();
            onPublish();
          }}
          style={{ marginHorizontal: 20, marginBottom: 20, paddingVertical: 16, borderRadius: momentFlow.radiusPill, backgroundColor: momentFlow.accent, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Publish to Unmask ✨</Text>
        </Pressable>

        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted, textAlign: "center", marginBottom: 12 }}>Share outside Unmask</Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 20, paddingBottom: 16 }}>
          {[
            { Icon: WhatsappLogo, color: "#25D366" },
            { Icon: InstagramLogo, color: "#E1306C" },
            { Icon: TiktokLogo, color: "#000" },
            { Icon: Sparkle, color: "#FFFC00" },
          ].map(({ Icon, color }, i) => (
            <Pressable key={i} onPress={() => hapticSelect()} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: momentFlow.card, alignItems: "center", justifyContent: "center" }}>
              <Icon size={28} color={color} weight="fill" />
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}