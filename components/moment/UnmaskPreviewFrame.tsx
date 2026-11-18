import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Waveform } from "@/components/icons";
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
  const framed = layers.backgroundMode !== "original";

  return (
    <View style={styles.root}>
      {layers.backgroundMode === "scene" && layers.backgroundUri ? (
        <Image source={{ uri: layers.backgroundUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : layers.backgroundMode === "blur" ? (
        <>
          <Image
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={Platform.OS === "ios" ? 18 : 0}
            accessibilityIgnoresInvertColors
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(26,10,20,0.55)" }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1A0A14" }]} />
      )}

      <View style={[styles.hero, { maxHeight: height * 0.68 }]}>
        {mediaKind === "video" ? (
          <LoopClip uri={mediaUri} poster={posterUri || mediaUri} height={framed ? height * 0.68 : height} />
        ) : (
          <Image
            source={{ uri: mediaUri }}
            style={framed ? styles.subjectContain : StyleSheet.absoluteFill}
            resizeMode={framed ? "contain" : "cover"}
            accessibilityIgnoresInvertColors
          />
        )}
      </View>

      {layers.lookTint && layers.lookOpacity > 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: layers.lookTint, opacity: layers.lookOpacity }]} />
      ) : null}
      {layers.lightOverlay && layers.lightOpacity > 0 ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: layers.lightOverlay, opacity: layers.lightOpacity }]} />
      ) : null}

      {label ? (
        <View style={styles.soundPill}>
          <Waveform size={14} color="#FFF8F4" weight="fill" />
          <Text style={styles.soundText} numberOfLines={1}>
            {label}
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
  },
});