# Unmask video post — diagnosis & architecture

## A. Current architecture (local Moments)

Unmask Moments are **client-local** today (Zustand + AsyncStorage `unmask-local-moments`). They do **not** go through Supabase `community-experiences` (images-only) or `creator-videos` (investigation workspace).

```
Select video (expo-image-picker, base64:false)
  → pickDeviceMomentMedia (mediaKind=video, poster still, web: IndexedDB unmask-media:)
  → draft.mediaUri + draft.mediaKind + draft.coverPosterUri
  → Compose (products / skin / routine context)
  → optional sound (creator.soundId)
  → Preview (UnmaskMomentCard + LoopClip)
  → Publish add({ photo: videoUri, mediaKind:"video", coverPosterUri, context… })
  → StoryItem.media = video URI, mediaKind=video, coverPosterUri=still
  → StoryStatusRail / UpdatesFeed / LivingFeed map video vs poster
  → StoryViewer / LivingFeed / pulse → LoopClip (<video> on web)
```

## B. Root cause (why it looked like an image)

On **master** (production until this PR merges):

1. **Bake overwrite** — successful Unmask brand bake set `playUri = publishUri`. For video that was a canvas webm/JPEG still, stored as `photo` while `mediaKind` stayed `"video"`.
2. **Web player** — `LoopClip` used expo-av with `shouldPlay={Platform.OS !== "web"}`; on error it fell back to `<Image>`.
3. **Ephemeral blobs** — `blob:` URLs persisted to AsyncStorage die on reload → decode fails → Image fallback.
4. **Feed exclusion** — `toFeed = !isMoment`, so Moments never appeared as LivingFeed video posts (only 24h status). Status section cards always show a **poster Image** (correct for cards); playback only happens inside StoryViewer.

## C. Required changes (this branch)

| Area | Fix |
|------|-----|
| Publish | Always keep original/durable video URI for in-app `photo` when `mediaKind===video` |
| Storage (web) | IndexedDB `unmask-media:` + resolve before `<video src>` |
| LoopClip | HTML5 muted autoplay; poster ≠ primary media |
| Feed | Moments can land in LivingFeed (`destination: both`); map `video` vs `coverPosterUri` |
| Sound | Optional overlay sound on video (library tracks already in-app) |
| Tab hide | Pause/stop status + BGM when document hidden |

## D. Minimal model

```
LocalMoment / StoryItem
  mediaKind: "photo" | "video"
  photo / media: playable video URI when video (never the poster alone)
  coverPosterUri?: still frame
  soundUri? / soundMaxMs?: optional overlay
  momentKind, products, skinType, usage*, occasion → product intelligence
```

Poster is preview/loading only. Primary media for video posts remains the video asset.
