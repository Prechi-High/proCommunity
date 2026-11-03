export async function applyNoiseCancellation(track: any) {
  // Native WebRTC capture is configured with echo cancellation,
  // noise suppression, and automatic gain control by LiveKit.
  return track;
}
