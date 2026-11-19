/**
 * Grab a still frame from a video blob/http URI for poster + Image fallbacks.
 * Returns a data URL, or null if the video cannot be decoded.
 */
export async function captureVideoPosterUri(videoUri: string, seekSec = 0.15): Promise<string | null> {
  if (typeof document === "undefined" || !videoUri) return null;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    let settled = false;
    const finish = (uri: string | null) => {
      if (settled) return;
      settled = true;
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
      resolve(uri);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    const grab = () => {
      try {
        const w = video.videoWidth || 720;
        const h = video.videoHeight || 1280;
        if (!w || !h) {
          window.clearTimeout(timer);
          finish(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          window.clearTimeout(timer);
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.85);
        window.clearTimeout(timer);
        finish(data.startsWith("data:image") ? data : null);
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };
    video.onloadeddata = () => {
      const target = Math.min(seekSec, Math.max(0, (video.duration || 1) * 0.05));
      try {
        video.currentTime = target;
      } catch {
        grab();
      }
    };
    video.onseeked = grab;
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    video.src = videoUri;
  });
}
