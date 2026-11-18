import type { MomentAudioBehavior } from "@/lib/moment/types";

function pickRecorderMime(): string | undefined {
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

export async function muxVideoWithMusic(
  videoBlob: Blob,
  musicUri: string,
  behavior: MomentAudioBehavior,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (behavior === "keep_original") return videoBlob;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(videoBlob);
  video.muted = behavior === "replace";
  video.playsInline = true;

  const music = document.createElement("audio");
  music.src = musicUri;
  music.crossOrigin = "anonymous";

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    }),
    new Promise<void>((resolve, reject) => {
      music.oncanplaythrough = () => resolve();
      music.onerror = () => reject(new Error("audio"));
    }),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 720;
  canvas.height = video.videoHeight || 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const audioCtx = new AudioContext();
  const destination = audioCtx.createMediaStreamDestination();
  const musicNode = audioCtx.createMediaElementSource(music);
  musicNode.connect(destination);

  if (behavior === "mix") {
    const videoAudio = audioCtx.createMediaElementSource(video);
    videoAudio.connect(destination);
  }

  const mime = pickRecorderMime();
  const videoStream = canvas.captureStream(24);
  const tracks = [...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()];
  const combined = new MediaStream(tracks);
  const recorder = new MediaRecorder(combined, mime ? { mimeType: mime, videoBitsPerSecond: 3_500_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const duration = Math.min(video.duration || 1, music.duration || video.duration || 1);
  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
    recorder.onerror = () => reject(new Error("record"));
  });

  recorder.start(200);
  await Promise.all([video.play(), music.play()]);

  const started = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (video.ended || performance.now() - started > duration * 1000 + 400) {
        resolve();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress?.(Math.min(0.98, video.currentTime / duration));
      requestAnimationFrame(tick);
    };
    tick();
  });

  recorder.stop();
  const out = await recorded;
  video.pause();
  music.pause();
  await audioCtx.close();
  URL.revokeObjectURL(video.src);
  onProgress?.(1);
  return out;
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}