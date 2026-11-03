export async function applyNoiseCancellation(track: any) {
  // LiveKit's WebRTC capture configuration enables echo cancellation,
  // noise suppression, and automatic gain control. Keep this helper
  // dependency-free so web and native builds resolve consistently.
  return track;
}
