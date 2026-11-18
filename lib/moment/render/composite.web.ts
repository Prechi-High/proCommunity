import * as bodySegmentation from "@tensorflow-models/body-segmentation";

type PersonSegmentation = Awaited<ReturnType<bodySegmentation.BodySegmenter["segmentPeople"]>>[number];

import type { PreviewLayers } from "@/lib/moment/unmaskCompose";

import { drawUnmaskBrandOverlay, type BrandOverlayInput } from "./brandOverlay.web";
import { segmentPerson } from "./segmentation.web";

async function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}

/** Soft person cutout: RGB from source, alpha from MediaPipe mask. */
async function cutoutPerson(
  source: HTMLImageElement | HTMLVideoElement,
  segmentation: PersonSegmentation,
  w: number,
  h: number,
): Promise<HTMLCanvasElement> {
  const mask = await bodySegmentation.toBinaryMask(
    [segmentation],
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 0 },
  );

  const person = document.createElement("canvas");
  person.width = w;
  person.height = h;
  const pctx = person.getContext("2d");
  if (!pctx) return person;
  pctx.drawImage(source, 0, 0, w, h);

  const alpha = document.createElement("canvas");
  alpha.width = w;
  alpha.height = h;
  const actx = alpha.getContext("2d");
  if (!actx) return person;
  actx.putImageData(mask, 0, 0);
  // Soften edges so hair/shoulders blend
  actx.filter = "blur(3px)";
  actx.drawImage(alpha, 0, 0);
  actx.filter = "none";

  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(alpha, 0, 0);
  pctx.globalCompositeOperation = "source-over";
  return person;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  bg: HTMLImageElement | null,
  w: number,
  h: number,
  blurPx: number,
) {
  if (!bg) {
    ctx.fillStyle = "#1A0A14";
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
    // Scale up slightly so blur doesn't show edges
    const pad = blurPx * 2;
    ctx.drawImage(bg, bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
    ctx.restore();
  } else {
    ctx.drawImage(bg, bx, by, bw, bh);
  }
}

export async function compositePhotoFrame(
  canvas: HTMLCanvasElement,
  sourceUri: string,
  layers: PreviewLayers,
  brand?: BrandOverlayInput,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const img = await loadImage(sourceUri);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  if (layers.backgroundMode === "original") {
    ctx.drawImage(img, 0, 0);
    applyTint(ctx, canvas.width, canvas.height, layers);
    if (brand) await drawUnmaskBrandOverlay(ctx, canvas.width, canvas.height, brand);
    return;
  }

  const segmentation = await segmentPerson(img);
  const person = await cutoutPerson(img, segmentation, canvas.width, canvas.height);

  if (layers.backgroundMode === "blur") {
    // Blurred original as scene, person on top — clean isolation
    const blurAmt = layers.sceneBlurAmount || 22;
    drawScene(ctx, img, canvas.width, canvas.height, blurAmt);
    ctx.drawImage(person, 0, 0);
    applyTint(ctx, canvas.width, canvas.height, layers);
    if (brand) await drawUnmaskBrandOverlay(ctx, canvas.width, canvas.height, brand);
    return;
  }

  const bg = layers.backgroundUri ? await loadImage(layers.backgroundUri) : null;
  drawScene(ctx, bg, canvas.width, canvas.height, layers.sceneBlurAmount || 0);
  ctx.drawImage(person, 0, 0);
  applyTint(ctx, canvas.width, canvas.height, layers);
  if (brand) await drawUnmaskBrandOverlay(ctx, canvas.width, canvas.height, brand);
}

export async function compositeVideoFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  layers: PreviewLayers,
  brand?: BrandOverlayInput,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;

  if (layers.backgroundMode === "original") {
    ctx.drawImage(video, 0, 0, w, h);
    applyTint(ctx, w, h, layers);
    if (brand) await drawUnmaskBrandOverlay(ctx, w, h, brand);
    return;
  }

  const segmentation = await segmentPerson(video);
  const person = await cutoutPerson(video, segmentation, w, h);

  if (layers.backgroundMode === "blur") {
    // Snapshot current frame as blur scene
    const snap = document.createElement("canvas");
    snap.width = w;
    snap.height = h;
    snap.getContext("2d")?.drawImage(video, 0, 0, w, h);
    const url = snap.toDataURL("image/jpeg", 0.7);
    const bgImg = await loadImage(url);
    drawScene(ctx, bgImg, w, h, layers.sceneBlurAmount || 22);
    ctx.drawImage(person, 0, 0);
    applyTint(ctx, w, h, layers);
    if (brand) await drawUnmaskBrandOverlay(ctx, w, h, brand);
    return;
  }

  const bg = layers.backgroundUri ? await loadImage(layers.backgroundUri) : null;
  drawScene(ctx, bg, w, h, layers.sceneBlurAmount || 0);
  ctx.drawImage(person, 0, 0);
  applyTint(ctx, w, h, layers);
  if (brand) await drawUnmaskBrandOverlay(ctx, w, h, brand);
}

function applyTint(ctx: CanvasRenderingContext2D, w: number, h: number, layers: PreviewLayers) {
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