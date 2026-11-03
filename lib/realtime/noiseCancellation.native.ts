export async function applyNoiseCancellation(track: any) {
  // Native LiveKit/WebRTC capture already enables echo cancellation, noise suppression, and auto gain control.
  // Krisp native is intentionally omitted until a package version compatible with the installed LiveKit RN SDK is available.
  return track;
}
