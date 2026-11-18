/**
 * Still cutout for mobile web via MediaPipe/tfjs body segmentation.
 * Always time-bounded so UI never spins forever.
 */
import type { PreviewLayers } from "@/lib/moment/unmaskCompose";

import type { BrandOverlayInput } from "./brandOverlay.web";
import { compositePhotoFrame } from "./composite.web";
import { withTimeout } from "./withTimeout";

const CUTOUT_MS = 28_000;

export async function compositePhotoCutout(
  canvas: HTMLCanvasElement,
  sourceUri: string,
  layers: PreviewLayers,
  brand?: BrandOverlayInput,
): Promise<void> {
  await withTimeout(compositePhotoFrame(canvas, sourceUri, layers, brand), CUTOUT_MS, "photo_cutout_timeout");
}

export async function canvasToJpegDataUri(canvas: HTMLCanvasElement, quality = 0.82): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", quality);
  });
  // Prefer object URL for display; data URI only when small enough for storage
  if (blob.size > 900_000) {
    return URL.createObjectURL(blob);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
