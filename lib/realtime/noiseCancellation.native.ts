export async function applyNoiseCancellation(track: any) {
  if (!track || typeof track.setProcessor !== "function") return;
  try {
    const mod = await import("@livekit/react-native-krisp-noise-filter");
    const processor = mod.KrispNoiseFilter();
    await track.setProcessor(processor);
  } catch {}
}
