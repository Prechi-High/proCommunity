import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Share, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, CaretRight, InstagramLogo, NotePencil, Sparkle, TiktokLogo, UsersThree, WhatsappLogo } from "@/components/icons";
import { ActionSheet } from "@/components/unmask-ui";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import { displayOccasion, productCount, type CreatorSettings, type MomentAudience, type MomentContext } from "@/lib/moment/types";

const AUDIENCE_LABEL: Record<MomentAudience, string> = {
  everyone: "Everyone",
  followers: "Followers",
  private: "Only me",
};

export function MomentShareScreen({
  kind,
  mediaUri,
  context,
  creator,
  caption,
  onCaptionChange,
  onOpenProducts,
  onBack,
  onPublish,
  onSaveDraft,
  publishing,
  publishError,
  saveToJourney,
  onToggleJourney,
  audience,
  onAudienceChange,
}: {
  kind: MomentKind;
  mediaUri: string;
  context: MomentContext;
  creator: CreatorSettings;
  caption: string;
  onCaptionChange: (v: string) => void;
  onOpenProducts?: () => void;
  onBack: () => void;
  onPublish: () => void;
  onSaveDraft?: () => void;
  publishing?: boolean;
  publishError?: string;
  saveToJourney: boolean;
  onToggleJourney: (v: boolean) => void;
  audience: MomentAudience;
  onAudienceChange: (a: MomentAudience) => void;
}) {
  const config = momentConfig(kind);
  const occasion = displayOccasion(context);
  const title = `${config.title} ${config.emoji}${occasion ? ` · ${occasion}` : ""}`.trim();
  const products = productCount(context);
  const sound = selectedSoundLabel(creator);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  async function shareOutside() {
    const message = `${title} — My routine + ${products} products on Unmask`;
    try {
      await Share.share({ message, url: mediaUri });
    } catch {
      /* cancelled */
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 }}>
          <Pressable onPress={onBack} disabled={publishing} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 8, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: momentFlow.ink }}>Share your Unmask</Text>
            <Text style={{ fontSize: 22 }}>🎉</Text>
          </View>
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
              {products} product{products === 1 ? "" : "s"}
              {sound ? ` · Sound: ${sound}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, marginTop: 16, borderRadius: momentFlow.radiusCard, backgroundColor: momentFlow.card, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}>
            <NotePencil size={18} color={momentFlow.muted} />
            <TextInput
              value={caption}
              onChangeText={onCaptionChange}
              placeholder="Add a caption…"
              placeholderTextColor={momentFlow.muted}
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: momentFlow.ink, paddingVertical: 4 }}
            />
          </View>
          <Pressable onPress={() => onOpenProducts?.()} style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Tag products ({products})</Text>
            <CaretRight size={18} color={momentFlow.muted} />
          </Pressable>
          <Pressable onPress={() => setPeopleOpen(true)} style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}>
            <UsersThree size={18} color={momentFlow.muted} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Add people</Text>
            <CaretRight size={18} color={momentFlow.muted} />
          </Pressable>
          <Pressable onPress={() => setAudienceOpen(true)} style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Audience</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: momentFlow.muted, marginRight: 4 }}>{AUDIENCE_LABEL[audience]}</Text>
            <CaretRight size={18} color={momentFlow.muted} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
            <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: momentFlow.ink }}>Save to Product Journey</Text>
            <Switch value={saveToJourney} onValueChange={onToggleJourney} trackColor={{ true: momentFlow.accent, false: momentFlow.accentSoft }} />
          </View>
        </View>

        {publishError ? (
          <Text style={{ marginHorizontal: 20, marginTop: 16, fontFamily: fonts.regular, fontSize: 14, color: "#B42318" }}>{publishError}</Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => {
            hapticSelect();
            onPublish();
          }}
          disabled={publishing}
          style={{
            marginHorizontal: 20,
            marginBottom: 12,
            paddingVertical: 16,
            borderRadius: momentFlow.radiusPill,
            backgroundColor: publishing ? momentFlow.muted : momentFlow.accent,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {publishing ? <ActivityIndicator color="#FFF8F4" /> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>
            {publishing ? "Publishing…" : "Publish to Unmask ✨"}
          </Text>
        </Pressable>

        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.muted, textAlign: "center", marginBottom: 12 }}>Also share to</Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 20, paddingBottom: 8 }}>
          {[
            { Icon: WhatsappLogo, color: "#25D366" },
            { Icon: InstagramLogo, color: "#E1306C" },
            { Icon: TiktokLogo, color: "#000" },
            { Icon: Sparkle, color: momentFlow.accent },
          ].map(({ Icon, color }, i) => (
            <Pressable
              key={i}
              onPress={() => {
                hapticSelect();
                void shareOutside();
              }}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: momentFlow.card, alignItems: "center", justifyContent: "center" }}
            >
              <Icon size={28} color={color} weight="fill" />
            </Pressable>
          ))}
        </View>

        {onSaveDraft ? (
          <Pressable
            onPress={() => {
              hapticSelect();
              onSaveDraft();
            }}
            disabled={publishing}
            style={{
              marginHorizontal: 20,
              marginBottom: 16,
              paddingVertical: 14,
              borderRadius: momentFlow.radiusPill,
              borderWidth: 1.5,
              borderColor: momentFlow.accent,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.accent }}>Save as Draft</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>

      <ActionSheet open={audienceOpen} title="Audience" onClose={() => setAudienceOpen(false)}>
        {(Object.keys(AUDIENCE_LABEL) as MomentAudience[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => {
              hapticSelect();
              onAudienceChange(key);
              setAudienceOpen(false);
            }}
            style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: momentFlow.accentSoft }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: audience === key ? momentFlow.accent : momentFlow.ink }}>
              {AUDIENCE_LABEL[key]}
            </Text>
          </Pressable>
        ))}
      </ActionSheet>

      <ActionSheet open={peopleOpen} title="Add people" onClose={() => setPeopleOpen(false)}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: momentFlow.muted, paddingVertical: 8 }}>
          Tag friends from Community soon. For now, your moment posts to your chosen audience.
        </Text>
      </ActionSheet>
    </View>
  );
}