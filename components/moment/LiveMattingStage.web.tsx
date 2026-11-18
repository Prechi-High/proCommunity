import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { fonts } from "@/constants/theme";
import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { CreatorSettings } from "@/lib/moment/types";
import { compositePhotoFrame, compositeVideoFrame } from "@/lib/moment/render/composite.web";

/**
 * Live / still matting stage for web — person cut out, scene replaced, blur dialed live.
 */
export function LiveMattingStage({
  mediaUri,
  mediaKind,
  creator,
  cameraVideoSelector = "video",
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
  const layers = resolvePreviewLayers(creator);
  const needsMatt = layers.backgroundMode !== "original";

  useEffect(() => {
    if (Platform.OS !== "web" || !needsMatt) return;
    let cancelled = false;
    let raf = 0;
    let videoEl: HTMLVideoElement | null = null;

    async function runPhoto() {
      if (!mediaUri) return;
      setBusy(true);
      setError("");
      try {
        const host = canvasRef.current;
        if (!host) return;
        await compositePhotoFrame(host, mediaUri, layers);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Cutout failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    async function runStream() {
      setBusy(true);
      setError("");
      try {
        if (mediaKind === "camera") {
          videoEl = document.querySelector(cameraVideoSelector) as HTMLVideoElement | null;
        } else if (mediaUri) {
          videoEl = document.createElement("video");
          videoEl.crossOrigin = "anonymous";
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.loop = true;
          videoEl.src = mediaUri;
          await new Promise<void>((resolve, reject) => {
            if (!videoEl) return reject(new Error("video"));
            videoEl.onloadeddata = () => resolve();
            videoEl.onerror = () => reject(new Error("video"));
          });
          await videoEl.play().catch(() => undefined);
        }
        if (!videoEl || cancelled) return;

        const tick = async () => {
          if (cancelled || !videoEl) return;
          const host = canvasRef.current;
          if (host && videoEl.videoWidth) {
            try {
              await compositeVideoFrame(host, videoEl, layers);
              setBusy(false);
            } catch {
              /* keep trying */
            }
          }
          raf = requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch (e) {
        if (!cancelled) {
          setBusy(false);
          setError(e instanceof Error ? e.message : "Live matting failed");
        }
      }
    }

    if (mediaKind === "photo") void runPhoto();
    else void runStream();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (videoEl && mediaKind !== "camera") {
        videoEl.pause();
        videoEl.src = "";
      }
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
    cameraVideoSelector,
  ]);

  if (!needsMatt) return null;

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
      <canvas
        ref={(node) => {
          canvasRef.current = node;
        }}
        style={{ width: "100%", height: height ? height : "100%", objectFit: "cover" } as never}
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
        <Text style={{ position: "absolute", bottom: 24, alignSelf: "center", fontFamily: fonts.medium, fontSize: 12, color: "#FFB4B4" }}>{error}</Text>
      ) : null}
    </View>
  );
}