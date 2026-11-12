/**
 * Frontend layers for this release.
 *
 * The First 90 teaches one habit: share an experience, keep a Product Timeline,
 * search products, and spend time in the community. Creator Studio and live /
 * audio rooms stay in the repo. They are hidden until a flag below is true.
 *
 * To bring a layer back, set its flag to true. Do not delete the screens,
 * LiveKit code, or API routes — a true flag should make the existing UI return.
 */
export const features = {
  /** Become a creator, Creator Studio, assigned cases, creator directory, host tools. */
  creatorStudio: false,
  /** Audio Rooms: /room, /room/session, join / host / mic. */
  audioRooms: false,
  /** Live as its own discovery surface: /live and /live/session. */
  live: false,
} as const;

export type FeatureFlag = keyof typeof features;

export function featureOn(flag: FeatureFlag): boolean {
  return features[flag];
}
