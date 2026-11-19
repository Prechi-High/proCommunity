/**
 * Branding-only bake: Unmask watermark + product/occasion context.
 * No background removal / studio FX.
 */
import { drawUnmaskBrandOverlay } from "./brandOverlay.web";
import { blobToDataUri } from "./webAudioMux.web";
import { needsUnmaskRender } from "./needsRender";
import { canvasToJpegDataUri } from "./photoCutout.web";
import { exportProcessedVideo } from "./videoExport.web";
import type { RenderInput, RenderOutput } from "./renderTypes";
import { withTimeout } from "./withTimeout";

export type { RenderInput, RenderOutput } from "./renderTypes";

const PHOTO_RENDER_MS = 20_000;
const VIDEO_RENDER_MS = 55_000;

async function brandPhoto(
  uri: string,
  brand: { kind?: RenderInput["kind"]; context?: RenderInput["context"] },
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image_load"));
    el.src = uri;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0);
  await drawUnmaskBrandOverlay(ctx, canvas.width, canvas.height, brand);
  return canvasToJpegDataUri(canvas, 0.85);
}

export async function renderUnmaskMediaWeb(
  input: RenderInput,
  onProgress?: (ratio: number, label: string) => void,
): Promise<RenderOutput> {
  if (!input.mediaUri) throw new Error("missing_media");
  const burnBranding = input.burnBranding !== false;
  if (!needsUnmaskRender({ mediaUri: input.mediaUri, burnBranding })) {
    return {
      outputUri: input.mediaUri,
      posterUri: input.coverPosterUri,
      processed: false,
      mimeType: input.mediaKind === "video" ? "video/mp4" : "image/jpeg",
    };
  }

  const brand = { kind: input.kind, context: input.context };
  onProgress?.(0.1, "Adding Unmask mark…");

  if (input.mediaKind === "photo") {
    const outputUri = await withTimeout(brandPhoto(input.mediaUri, brand), PHOTO_RENDER_MS, "brand_photo_timeout");
    onProgress?.(1, "Ready");
    return { outputUri, posterUri: outputUri, processed: true, mimeType: "image/jpeg" };
  }

  onProgress?.(0.15, "Burning Unmask mark…");
  const blob = await withTimeout(
    exportProcessedVideo(
      input.mediaUri,
      "video",
      input.creator,
      (ratio) => onProgress?.(0.15 + ratio * 0.8, "Adding Unmask mark…"),
      brand,
    ),
    VIDEO_RENDER_MS,
    "brand_video_timeout",
  );
  onProgress?.(1, "Ready");
  const outputUri = blob.size > 1_200_000 ? URL.createObjectURL(blob) : await blobToDataUri(blob);
  return {
    outputUri,
    posterUri: input.coverPosterUri,
    processed: true,
    mimeType: blob.type || "video/webm",
  };
}
