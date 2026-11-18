import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, View } from "react-native";

import { fonts } from "@/constants/theme";
import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { CreatorSettings } from "@/lib/moment/types";
import { compositePhotoCutout } from "@/lib/moment/render/photoCutout.web";

/**
 * Live matting:
 * - Photos: real cutout (imgly → mediapipe) with hard timeout — never infinite spinner
 * - Camera/video: show selected scene immediately; bake cutout once when a still is ready
 */
export function LiveMattingStage({
  mediaUri,
  mediaKind,
  creator,
  height,
}: {
  mediaUri?: string;
  mediaKind: "photo" | "video" | "camera";
  creator: CreatorSettings;
  cameraVideoSelector?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const layers = resolvePreviewLayers(creator);
  const needsMatt = layers.backgroundMode !== "original";

  useEffect(() => {
    if (Platform.OS !== "web" || !needsMatt) return;
    let cancelled = false;

    async function runPhoto() {
      if (!mediaUri) return;
      setBusy(true);
      setError("");
      setDone(false);
      try {
        const host = canvasRef.current;
        if (!host) return;
        await compositePhotoCutout(host, mediaUri, layers);
        if (!cancelled) setDone(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message.replace(/_/g, " ") : "Cutout failed — try again or reset BG");
          setDone(false);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    if (mediaKind === "photo") void runPhoto();
    else {
      // Camera/video: scene preview only (cutout happens on bake/publish)
      setBusy(false);
      setDone(false);
      setError("");
    }

    return () => {
      cancelled = true;
    };
  }, [
    mediaUri,
    mediaKind,
    needsMatt,
    layers.backgroundMode,
    layers.backgroundUri,
    layers.sceneBlurAmount,
    creator.backgroundId,
    creator.localBackgroundUri,
    creator.backgroundBlurAmount,
    creator.lookId,
    creator.lightingId,
  ]);

  if (!needsMatt) return null;

  // Optimistic scene for camera / video while recording
  if (mediaKind !== "photo") {
    return (
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 }} pointerEvents="none">
        {layers.backgroundUri ? (
          <Image
            source={{ uri: layers.backgroundUri }}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            blurRadius={Math.min(40, layers.sceneBlurAmount || 0) / 2}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#1A0A14" }} />
        )}
        <View
          style={{
            position: "absolute",
            top: 16,
            alignSelf: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>
            BG selected — clean cutout applies on Preview
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 1,
        backgroundColor: "#0A0610",
      }}
      pointerEvents="none"
    >
      {!done && layers.backgroundUri ? (
        <Image
          source={{ uri: layers.backgroundUri }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: 0.85 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <canvas
        ref={(node) => {
          canvasRef.current = node;
        }}
        style={
          {
            width: "100%",
            height: height ? height : "100%",
            objectFit: "cover",
            opacity: done ? 1 : 0,
          } as never
        }
      />
      {busy ? (
        <View
          style={{
            position: "absolute",
            top: 16,
            alignSelf: "center",
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <ActivityIndicator color="#FF8BC8" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: "#FFF8F4" }}>Removing background…</Text>
        </View>
      ) : null}
      {error ? (
        <View
          style={{
            position: "absolute",
            bottom: 24,
            left: 16,
            right: 16,
            padding: 10,
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#FFB4B4", textAlign: "center" }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}