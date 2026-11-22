import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArrowLeft, BookmarkSimple, InstagramLogo, Lock, TiktokLogo, UsersThree, WhatsappLogo } from "@/components/icons";
import { UnmaskMomentCard } from "@/components/moment/UnmaskMomentCard";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { momentFlow } from "@/lib/moment/flowTheme";
import { momentConfig, type MomentKind } from "@/lib/moment/kinds";
import { selectedSoundLabel } from "@/lib/moment/creatorCatalog";
import { displayOccasion, productCount, type CreatorSettings, type MomentAudience, type MomentContext } from "@/lib/moment/types";

const AUDIENCE: { id: MomentAudience; label: string; hint: string; Icon: typeof UsersThree }[] = [
  { id: "everyone", label: "Everyone", hint: "Public", Icon: UsersThree },
  { id: "followers", label: "My Followers", hint: "Only", Icon: UsersThree },
  { id: "private", label: "Only Me", hint: "Private", Icon: Lock },
];

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
  onExportShare,
  onSaveDraft,
  publishing,
  publishError,
  renderHint,
  saveToJourney,
  onToggleJourney,
  audience,
  onAudienceChange,
  productStory,
  posterUri,
  mediaKind = "photo",
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
  onExportShare?: () => Promise<string>;
  onSaveDraft?: () => void;
  publishing?: boolean;
  publishError?: string;
  renderHint?: string;
  saveToJourney: boolean;
  onToggleJourney: (v: boolean) => void;
  audience: MomentAudience;
  onAudienceChange: (a: MomentAudience) => void;
  productStory?: boolean;
  posterUri?: string;
  mediaKind?: "photo" | "video";
}) {
  const config = momentConfig(kind);
  const occasion = displayOccasion(context);
  const [exporting, setExporting] = useState(false);

  async function shareOutside() {
    const productLine = (context.products ?? [])
      .map((p) => (p.brand ? `${p.brand} ${p.name}` : p.name).trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ");
    const title = context.momentTitle || `${config.title}${occasion ? ` · ${occasion}` : ""}`;
    const deepLink =
      typeof window !== "undefined" && window.location?.origin
        ? `${window.location.origin}/community`
        : "https://unmasker.vercel.app/community";
    const message = [
      `${title} on Unmask ✦`,
      productLine ? `Using: ${productLine}` : null,
      caption?.trim() || null,
      `See the routine & products → ${deepLink}`,
    ]
      .filter(Boolean)
      .join("\n");
    setExporting(true);
    try {
      // Prefer branded bake; fall back to original media so share never sends a black frame.
      let url = mediaUri;
      try {
        if (onExportShare) url = (await onExportShare()) || mediaUri;
      } catch {
        url = mediaUri;
      }
      await Share.share({ message, url: url || mediaUri });
    } catch {
      /* cancelled */
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: momentFlow.bg }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 }}>
          <Pressable onPress={onBack} disabled={publishing} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color={momentFlow.ink} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 20, color: momentFlow.ink }}>Unmask</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: momentFlow.ink }}>Share Your Unmask ✨</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: momentFlow.muted }}>
              Your moment is ready! Choose where to share it.
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
            compact
            playing
          />

          <TextInput
            value={caption}
            onChangeText={onCaptionChange}
            placeholder="Add a caption…"
            placeholderTextColor={momentFlow.muted}
            style={{
              padding: 14,
              borderRadius: 16,
              backgroundColor: momentFlow.card,
              borderWidth: 1,
              borderColor: momentFlow.accentSoft,
              fontFamily: fonts.regular,
              fontSize: 15,
              color: momentFlow.ink,
            }}
          />

          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.ink }}>Who can see this?</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {AUDIENCE.map(({ id, label, Icon }) => {
              const active = audience === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    hapticSelect();
                    onAudienceChange(id);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                    borderRadius: 16,
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: active ? momentFlow.pillPink : momentFlow.card,
                    borderWidth: 1.5,
                    borderColor: active ? momentFlow.accent : momentFlow.accentSoft,
                  }}
                >
                  <Icon size={20} color={active ? momentFlow.accent : momentFlow.muted} weight={active ? "fill" : "regular"} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: active ? momentFlow.accent : momentFlow.ink, textAlign: "center" }}>
                    {label}
                  </Text>
                  {active ? (
                    <View style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: "#E23B3B", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#FFF", fontSize: 10, fontFamily: fonts.bold }}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {renderHint && !publishError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: momentFlow.muted }}>{renderHint}</Text>
          ) : null}
          {publishError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: "#B42318" }}>{publishError}</Text>
          ) : null}

          <Pressable
            onPress={() => {
              hapticSelect();
              onPublish();
            }}
            disabled={publishing}
            style={{
              paddingVertical: 16,
              borderRadius: momentFlow.radiusPill,
              backgroundColor: publishing ? momentFlow.muted : "#C94B6A",
              alignItems: "center",
            }}
          >
            {publishing ? <ActivityIndicator color="#FFF8F4" /> : (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Share to Unmask</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => onToggleJourney(!saveToJourney)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 16,
              borderRadius: 16,
              backgroundColor: momentFlow.card,
              borderWidth: 1,
              borderColor: saveToJourney ? momentFlow.accent : momentFlow.accentSoft,
            }}
          >
            <BookmarkSimple size={22} color={momentFlow.accent} weight={saveToJourney ? "fill" : "regular"} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: momentFlow.ink }}>Save to My Journey</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted }}>Keep this moment in your product timeline</Text>
            </View>
          </Pressable>

          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: momentFlow.muted, textAlign: "center", marginTop: 4 }}>
            {exporting ? "Preparing export…" : "Share externally"}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
            {[
              { Icon: InstagramLogo, color: "#E1306C", label: "Instagram" },
              { Icon: TiktokLogo, color: "#111", label: "TikTok" },
              { Icon: WhatsappLogo, color: "#25D366", label: "WhatsApp" },
            ].map(({ Icon, color, label }) => (
              <Pressable
                key={label}
                disabled={exporting || publishing}
                onPress={() => {
                  hapticSelect();
                  void shareOutside();
                }}
                style={{ alignItems: "center", gap: 6, opacity: exporting ? 0.5 : 1 }}
              >
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: momentFlow.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: momentFlow.accentSoft }}>
                  {exporting ? <ActivityIndicator color={momentFlow.accent} /> : <Icon size={26} color={color} weight="fill" />}
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: momentFlow.muted }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {onSaveDraft ? (
            <Pressable onPress={onSaveDraft} style={{ alignItems: "center", paddingVertical: 12 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: momentFlow.accent }}>Save as Draft</Text>
            </Pressable>
          ) : null}

          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: momentFlow.muted, textAlign: "center" }}>
            {productCount(context)} product{productCount(context) === 1 ? "" : "s"}
            {selectedSoundLabel(creator) ? ` · ${selectedSoundLabel(creator)}` : ""}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
