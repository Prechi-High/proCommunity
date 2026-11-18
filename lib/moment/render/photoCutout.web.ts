/**
 * Reliable still cutout for mobile web:
 * 1) @imgly/background-removal (best quality)
 * 2) MediaPipe/tfjs fallback
 * Always time-bounded so UI never spins forever.
 */
import { removeBackground } from "@imgly/background-removal";

import type { PreviewLayers } from "@/lib/moment/unmaskCompose";

import { compositePhotoFrame } from "./composite.web";
import { withTimeout } from "./withTimeout";

const CUTOUT_MS = 28_000;

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load"));
    img.src = uri;
  });
}

async function cutoutWithImgly(uri: string): Promise<HTMLCanvasElement> {
  const blob = await withTimeout(
    removeBackground(uri, {
      model: "isnet_quint8", // fastest / smallest — better for mobile web
      output: { format: "image/png", quality: 0.9 },
    }),
    CUTOUT_MS,
    "imgly_timeout",
  );
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement | null,
  w: number,
  h: number,
  blurPx: number,
  fill = "#1A0A14",
) {
  if (!bg) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
  const bw = bg.naturalWidth * scale;
  const bh = bg.naturalHeight * scale;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2;
  if (blurPx > 0) {
    ctx.save();
    ctx.filter = `blur(${Math.min(40, blurPx)}px)`;
    const pad = blurPx * 2;
    ctx.drawImage(bg, bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
    ctx.restore();
  } else {
    ctx.drawImage(bg, bx, by, bw, bh);
  }
}

export async function compositePhotoCutout(
  canvas: HTMLCanvasElement,
  sourceUri: string,
  layers: PreviewLayers,
): Promise<void> {
  if (layers.backgroundMode === "original") {
    await compositePhotoFrame(canvas, sourceUri, layers);
    return;
  }

  let person: HTMLCanvasElement | null = null;
  try {
    person = await cutoutWithImgly(sourceUri);
  } catch {
    // Fall back to MediaPipe/tfjs composite (also timed)
    await withTimeout(compositePhotoFrame(canvas, sourceUri, layers), CUTOUT_MS, "mediapipe_timeout");
    return;
  }

  const w = person.width;
  const h = person.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  if (layers.backgroundMode === "blur") {
    const original = await loadImage(sourceUri);
    drawScene(ctx, original, w, h, layers.sceneBlurAmount || 22);
  } else {
    const bg = layers.backgroundUri ? await loadImage(layers.backgroundUri) : null;
    drawScene(ctx, bg, w, h, layers.sceneBlurAmount || 0);
  }
  ctx.drawImage(person, 0, 0);

  if (layers.lookTint && layers.lookOpacity > 0) {
    ctx.fillStyle = layers.lookTint;
    ctx.globalAlpha = layers.lookOpacity;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (layers.lightOverlay && layers.lightOpacity > 0) {
    ctx.fillStyle = layers.lightOverlay;
    ctx.globalAlpha = layers.lightOpacity;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
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