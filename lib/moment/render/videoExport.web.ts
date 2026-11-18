import { MOMENT_MEDIA_LIMITS } from "@/lib/moment/mediaLimits";
import { resolvePreviewLayers } from "@/lib/moment/unmaskCompose";
import type { CreatorSettings } from "@/lib/moment/types";

import type { BrandOverlayInput } from "./brandOverlay.web";
import { compositePhotoFrame, compositeVideoFrame } from "./composite.web";

const MAX_RENDER_SEC = Math.min(90, MOMENT_MEDIA_LIMITS.maxVideoDurationSec);
const TARGET_FPS = 24;
const MAX_EDGE = 720;

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
  });
}

async function loadVideo(uri: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.src = uri;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("video"));
  });
  return video;
}

function pickRecorderMime(): string | undefined {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

export async function exportProcessedVideo(
  mediaUri: string,
  mediaKind: "photo" | "video",
  creator: CreatorSettings,
  onProgress: (ratio: number) => void,
  brand?: BrandOverlayInput,
): Promise<Blob> {
  const layers = resolvePreviewLayers(creator);
  const canvas = document.createElement("canvas");

  if (mediaKind === "photo") {
    await compositePhotoFrame(canvas, mediaUri, layers, brand);
    onProgress(0.4);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.92);
    });
    onProgress(1);
    return blob;
  }

  const video = await loadVideo(mediaUri);
  const duration = Math.min(video.duration || MAX_RENDER_SEC, MAX_RENDER_SEC);
  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  canvas.width = w;
  canvas.height = h;

  const mime = pickRecorderMime();
  const stream = canvas.captureStream(TARGET_FPS);
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
    recorder.onerror = () => reject(new Error("record"));
  });

  recorder.start(250);
  const frameStep = 1 / TARGET_FPS;
  const frames = Math.ceil(duration * TARGET_FPS);

  for (let i = 0; i < frames; i += 1) {
    const t = Math.min(duration - 0.001, i * frameStep);
    video.currentTime = t;
    await waitForSeek(video);
    canvas.width = w;
    canvas.height = h;
    await compositeVideoFrame(canvas, video, layers, brand);
    onProgress(Math.min(0.92, i / frames));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }

  recorder.stop();
  const blob = await recorded;
  onProgress(0.95);
  video.remove();
  return blob;
}
