/**
 * Still cutout + scene composite using MediaPipe (same pipeline as video frames).
 */
import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { CreatorSettings } from "@/lib/moment/types";

import { compositePhotoFrame } from "./composite.web";

export async function cutoutPersonFromUri(uri: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  // Temporary original-only draw — LiveMattingStage uses compositePhotoFrame directly.
  const img = await loadImage(uri);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")?.drawImage(img, 0, 0);
  return canvas;
}

export async function compositeCutoutOverScene(
  _personCanvas: HTMLCanvasElement,
  sceneUri: string | null,
  opts: { blurScene?: number; fill?: string; sourceUri?: string },
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  if (!opts.sourceUri) return canvas;
  const creator: CreatorSettings = {
    backgroundId: sceneUri ? "custom" : "blur",
    localBackgroundUri: sceneUri || undefined,
    backgroundBlurAmount: opts.blurScene ?? 0,
  };
  const layers = resolvePreviewLayers(creator);
  await compositePhotoFrame(canvas, opts.sourceUri, layers);
  return canvas;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}