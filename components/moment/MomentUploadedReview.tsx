import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as VideoThumbnails from "expo-video-thumbnails";

import { ArrowClockwise, ArrowLeft, Trash } from "@/components/icons";
import { ScrubVideo } from "@/components/moment/ScrubVideo";
import { fonts } from "@/constants/theme";
import { hapticSelect } from "@/lib/haptics";
import { formatDuration } from "@/lib/moment/mediaLimits";
import type { MomentMediaAsset } from "@/lib/moment/types";

export function MomentUploadedReview({
  asset,
  processing,
  error,
  onBack,
  onRemove,
  onReselect,
  onCover,
  onContinue,
}: {
  asset: MomentMediaAsset;
  processing?: boolean;
  error?: string;
  onBack: () => void;
  onRemove: () => void;
  onReselect: () => void;
  onCover: (coverPosterUri: string | undefined, coverTimeMs: number) => void;
  onContinue: () => void;
}) {
  const [positionMs, setPositionMs] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);

  async function setCoverFromPlayhead() {
    if (asset.kind !== "video") return;
    setCoverBusy(true);
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: Math.max(0, positionMs) });
      onCover(uri, positionMs);
    } catch {
      onCover(asset.posterUri, positionMs);
    } finally {
      setCoverBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A14" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 }}>
          <Pressable onPress={onBack} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={22} color="#FFF8F4" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: "#FFF8F4" }}>Your upload</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 12, borderRadius: 20, overflow: "hidden" }}>
          {asset.kind === "video" ? (
            <ScrubVideo uri={asset.uri} poster={asset.posterUri} onPositionMs={setPositionMs} />
          ) : (
            <Image source={{ uri: asset.uri }} style={{ flex: 1, width: "100%" }} resizeMode="contain" accessibilityIgnoresInvertColors />
          )}
        </View>

        <View style={{ padding: 20, gap: 12 }}>
          {asset.durationMs != null ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,248,244,0.8)", textAlign: "center" }}>
              Duration {formatDuration(asset.durationMs)}
              {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            </Text>
          ) : null}

          {processing ? (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, alignItems: "center" }}>
              <ActivityIndicator color="#FF6B9D" />
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: "#FFF8F4" }}>Preparing your media…</Text>
            </View>
          ) : null}
          {error ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: "#FFB4B4", textAlign: "center" }}>{error}</Text> : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => {
                hapticSelect();
                onReselect();
              }}
              style={{ flex: 1, flexDirection: "row", gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}
            >
              <ArrowClockwise size={18} color="#FFF8F4" />
              <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Replace</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                hapticSelect();
                onRemove();
              }}
              style={{ flex: 1, flexDirection: "row", gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}
            >
              <Trash size={18} color="#FFF8F4" />
              <Text style={{ fontFamily: fonts.semibold, color: "#FFF8F4" }}>Remove</Text>
            </Pressable>
          </View>

          {asset.kind === "video" ? (
            <Pressable
              disabled={coverBusy}
              onPress={() => void setCoverFromPlayhead()}
              style={{ paddingVertical: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center" }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#FFF8F4" }}>{coverBusy ? "Saving cover…" : "Use this frame as cover"}</Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={processing}
            onPress={() => {
              hapticSelect();
              onContinue();
            }}
            style={{ paddingVertical: 16, borderRadius: 999, backgroundColor: "#70323E", alignItems: "center" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: "#FFF8F4" }}>Continue →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}