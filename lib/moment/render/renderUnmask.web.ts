import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { MomentAudioBehavior } from "@/lib/moment/types";

import { blobToDataUri, muxVideoWithMusic } from "./webAudioMux.web";
import { needsUnmaskRender, resolveMusicUri, shouldMuxAudio } from "./needsRender";
import { compositePhotoFrame } from "./composite.web";
import { exportProcessedVideo } from "./videoExport.web";
import type { RenderInput, RenderOutput } from "./renderTypes";

export type { RenderInput, RenderOutput } from "./renderTypes";

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
  const needsMux = shouldMuxAudio(input.mediaKind, input.audioBehavior, input.creator);

  onProgress?.(0.02, "Loading creator tools…");

  let blob: Blob;
  if (input.mediaKind === "photo") {
    if (!needsBg) {
      blob = await fetch(input.mediaUri).then((r) => r.blob());
    } else {
      const canvas = document.createElement("canvas");
      await compositePhotoFrame(canvas, input.mediaUri, layers);
      onProgress?.(0.65, "Applying Unmask finish…");
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.92);
      });
    }
    onProgress?.(1, "Ready");
    const data = await blobToDataUri(blob);
    return { outputUri: data, posterUri: data, processed: true, mimeType: "image/jpeg" };
  }

  if (needsBg) {
    onProgress?.(0.05, "Segmenting person in video…");
    blob = await exportProcessedVideo(input.mediaUri, input.mediaKind, input.creator, (ratio) => {
      onProgress?.(0.05 + ratio * 0.75, "Replacing background frames…");
    });
  } else {
    blob = await fetch(input.mediaUri).then((r) => r.blob());
    onProgress?.(0.4, "Preparing video…");
  }

  if (needsMux) {
    const musicUri = resolveMusicUri(input.creator);
    if (!musicUri) throw new Error("missing_music");
    const behavior = (input.audioBehavior ?? "replace") as MomentAudioBehavior;
    onProgress?.(0.82, "Mixing music into video…");
    blob = await muxVideoWithMusic(blob, musicUri, behavior, (ratio) => {
      onProgress?.(0.82 + ratio * 0.16, "Encoding final video…");
    });
  }

  onProgress?.(1, "Ready");
  const outputUri = await blobToDataUri(blob);
  return {
    outputUri,
    posterUri: input.coverPosterUri ?? outputUri,
    processed: true,
    mimeType: blob.type || (needsMux ? "video/mp4" : "video/webm"),
  };
}