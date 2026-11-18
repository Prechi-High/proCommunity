import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { MomentAudioBehavior } from "@/lib/moment/types";

import { blobToDataUri, muxVideoWithMusic } from "./webAudioMux.web";
import { needsUnmaskRender, resolveMusicUri, shouldMuxAudio } from "./needsRender";
import { canvasToJpegDataUri, compositePhotoCutout } from "./photoCutout.web";
import { exportProcessedVideo } from "./videoExport.web";
import type { RenderInput, RenderOutput } from "./renderTypes";
import { withTimeout } from "./withTimeout";

export type { RenderInput, RenderOutput } from "./renderTypes";

const PHOTO_RENDER_MS = 35_000;
const VIDEO_RENDER_MS = 55_000;
const MUX_MS = 40_000;

export async function renderUnmaskMediaWeb(
  input: RenderInput,
  onProgress?: (ratio: number, label: string) => void,
): Promise<RenderOutput> {
  if (!input.mediaUri) throw new Error("missing_media");
  if (!needsUnmaskRender(input)) {
    return {
      outputUri: input.mediaUri,
      posterUri: input.coverPosterUri,
      processed: false,
      mimeType: input.mediaKind === "video" ? "video/mp4" : "image/jpeg",
    };
  }

  const layers = resolvePreviewLayers(input.creator);
  const needsBg = layers.backgroundMode !== "original" || layers.lookOpacity > 0 || layers.lightOpacity > 0;
  // Skip mux for local device audio — blob/file mux is flaky on mobile; attach as BGM instead.
  const musicUri = resolveMusicUri(input.creator);
  const localMusic = Boolean(input.creator.localSoundUri);
  const needsMux = shouldMuxAudio(input.mediaKind, input.audioBehavior, input.creator) && !localMusic && Boolean(musicUri);

  onProgress?.(0.05, "Preparing Unmask…");

  if (input.mediaKind === "photo") {
    if (!needsBg) {
      return {
        outputUri: input.mediaUri,
        posterUri: input.coverPosterUri || input.mediaUri,
        processed: false,
        mimeType: "image/jpeg",
      };
    }
    onProgress?.(0.15, "Removing background…");
    const canvas = document.createElement("canvas");
    await withTimeout(compositePhotoCutout(canvas, input.mediaUri, layers), PHOTO_RENDER_MS, "photo_cutout_timeout");
    onProgress?.(0.85, "Saving…");
    const outputUri = await canvasToJpegDataUri(canvas, 0.8);
    onProgress?.(1, "Ready");
    return { outputUri, posterUri: outputUri, processed: true, mimeType: "image/jpeg" };
  }

  let blob: Blob;
  if (needsBg) {
    onProgress?.(0.08, "Segmenting video…");
    blob = await withTimeout(
      exportProcessedVideo(input.mediaUri, input.mediaKind, input.creator, (ratio) => {
        onProgress?.(0.08 + ratio * 0.7, "Replacing background…");
      }),
      VIDEO_RENDER_MS,
      "video_cutout_timeout",
    );
  } else {
    blob = await fetch(input.mediaUri).then((r) => r.blob());
    onProgress?.(0.4, "Preparing video…");
  }

  if (needsMux && musicUri) {
    const behavior = (input.audioBehavior ?? "replace") as MomentAudioBehavior;
    onProgress?.(0.82, "Mixing music…");
    try {
      blob = await withTimeout(
        muxVideoWithMusic(blob, musicUri, behavior, (ratio) => {
          onProgress?.(0.82 + ratio * 0.15, "Encoding…");
        }),
        MUX_MS,
        "mux_timeout",
      );
    } catch {
      // Keep video without muxed audio — soundUri still attached on publish
      onProgress?.(0.95, "Keeping soundtrack separate…");
    }
  }

  onProgress?.(1, "Ready");
  // Prefer object URL for large video blobs (AsyncStorage-safe)
  const outputUri = blob.size > 1_200_000 ? URL.createObjectURL(blob) : await blobToDataUri(blob);
  return {
    outputUri,
    posterUri: input.coverPosterUri,
    processed: true,
    mimeType: blob.type || "video/webm",
  };
}