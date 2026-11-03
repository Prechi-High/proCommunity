export async function applyNoiseCancellation(track: any) {
  if (!track || typeof track.setProcessor !== "function") return;
  try {
    const mod = await import("@livekit/krisp-noise-filter");
    const supported = typeof mod.isKrispNoiseFilterSupported === "function" ? mod.isKrispNoiseFilterSupported() : true;
    if (!supported) return;
    const processor = mod.KrispNoiseFilter();
    await track.setProcessor(processor);
    await processor.setEnabled(true);
  } catch {}
}
