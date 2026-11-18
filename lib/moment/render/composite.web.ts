import * as bodySegmentation from "@tensorflow-models/body-segmentation";

type PersonSegmentation = Awaited<ReturnType<bodySegmentation.BodySegmenter["segmentPeople"]>>[number];

import type { PreviewLayers } from "@/lib/moment/unmaskCompose";

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

export async function compositePhotoFrame(
  canvas: HTMLCanvasElement,
  sourceUri: string,
  layers: PreviewLayers,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const img = await loadImage(sourceUri);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  if (layers.backgroundMode === "original") {
    ctx.drawImage(img, 0, 0);
    applyTint(ctx, canvas.width, canvas.height, layers);
    return;
  }

  const segmentation = await segmentPerson(img);

  if (layers.backgroundMode === "blur") {
    await bodySegmentation.drawBokehEffect(canvas, img, [segmentation], 0.25, 28, 6);
    applyTint(ctx, canvas.width, canvas.height, layers);
    return;
  }

  const bg = layers.backgroundUri ? await loadImage(layers.backgroundUri) : null;
  await drawSceneComposite(ctx, img, segmentation, bg, canvas.width, canvas.height);
  applyTint(ctx, canvas.width, canvas.height, layers);
}

export async function compositeVideoFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  layers: PreviewLayers,
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
    return;
  }

  const segmentation = await segmentPerson(video);

  if (layers.backgroundMode === "blur") {
    await bodySegmentation.drawBokehEffect(canvas, video, [segmentation], 0.25, 24, 5);
    applyTint(ctx, w, h, layers);
    return;
  }

  const bg = layers.backgroundUri ? await loadImage(layers.backgroundUri) : null;
  await drawSceneComposite(ctx, video, segmentation, bg, w, h);
  applyTint(ctx, w, h, layers);
}

async function drawSceneComposite(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  segmentation: PersonSegmentation,
  bg: HTMLImageElement | null,
  w: number,
  h: number,
) {
  if (bg) {
    const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
    const bw = bg.naturalWidth * scale;
    const bh = bg.naturalHeight * scale;
    const bx = (w - bw) / 2;
    const by = (h - bh) / 2;
    ctx.drawImage(bg, bx, by, bw, bh);
  } else {
    ctx.fillStyle = "#1A0A14";
    ctx.fillRect(0, 0, w, h);
  }

  const mask = await bodySegmentation.toBinaryMask(
    [segmentation],
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 0 },
  );
  const person = document.createElement("canvas");
  person.width = w;
  person.height = h;
  const personCtx = person.getContext("2d");
  if (!personCtx) return;
  await bodySegmentation.drawMask(person, source, mask, 1, 6);
  ctx.drawImage(person, 0, 0);
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