/** Track recent user gestures so media can unlock audio (browser autoplay policy). */
let lastGestureAt = 0;

export function markUserGesture() {
  lastGestureAt = Date.now();
}

export function withinUserGesture(windowMs = 5_000): boolean {
  return Date.now() - lastGestureAt < windowMs;
}
