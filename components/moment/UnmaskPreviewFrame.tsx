import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Waveform } from "@/components/icons";
import { LiveMattingStage } from "@/components/moment/LiveMattingStage";
import { fonts } from "@/constants/theme";
import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { CreatorSettings } from "@/lib/moment/types";
import { LoopClip } from "@/components/social/LoopClip";

export function UnmaskPreviewFrame({
  mediaUri,
  mediaKind,
  creator,
  soundLabel,
  posterUri,
  children,
}: {
  mediaUri: string;
  mediaKind: "photo" | "video";
  creator: CreatorSettings;
  soundLabel?: string | null;
  posterUri?: string;
  children?: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const layers = resolvePreviewLayers(creator);
  const label = soundLabel ?? layers.soundLabel;
  const matting = layers.backgroundMode !== "original" && Platform.OS === "web";

  return (
    <View style={styles.root}>
      {matting ? (
        <LiveMattingStage mediaUri={mediaUri} mediaKind={mediaKind} creator={creator} height={height} />
      ) : (
        <>
          {layers.backgroundMode === "scene" && layers.backgroundUri ? (
            <Image source={{ uri: layers.backgroundUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1A0A14" }]} />
          )}
          <View style={[styles.hero, { maxHeight: height * 0.72 }]}>
            {mediaKind === "video" ? (
              <LoopClip uri={mediaUri} poster={posterUri || mediaUri} height={height * 0.72} />
            ) : (
              <Image source={{ uri: mediaUri }} style={styles.subjectContain} resizeMode="cover" accessibilityIgnoresInvertColors />
            )}
          </View>
          {layers.lookTint && layers.lookOpacity > 0 ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: layers.lookTint, opacity: layers.lookOpacity }]} />
          ) : null}
          {layers.lightOverlay && layers.lightOpacity > 0 ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: layers.lightOverlay, opacity: layers.lightOpacity }]} />
          ) : null}
        </>
      )}

      {label ? (
        <View style={styles.soundPill}>
          <Waveform size={14} color="#FFF8F4" weight="fill" />
          <Text style={styles.soundText} numberOfLines={1}>
            ♪ {label}
          </Text>
        </View>
      ) : null}

      {children ? <View style={styles.overlay} pointerEvents="box-none">{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0A14",
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  subjectContain: {
    width: "100%",
    height: "100%",
  },
  soundPill: {
    position: "absolute",
    top: 58,
    right: 16,
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    maxWidth: "55%",
  },
  soundText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: "#FFF8F4",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
});