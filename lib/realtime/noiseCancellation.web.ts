export async function applyNoiseCancellation(track: any) {
  // Browser WebRTC capture is configured with echoCancellation,
  // noiseSuppression, and autoGainControl by the LiveKit Room.
  return track;
}
