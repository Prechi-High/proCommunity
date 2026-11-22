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

## B. Root cause (why status looked like an image)

**Exact failure in the viewer:** `LoopClip` treated any play/decode error as terminal and **replaced the video with `<Image poster>`**. Opening status therefore showed a still photo even when `mediaKind === "video"`.

Contributing causes:

1. **Bake overwrite (master)** — brand bake could set `photo` to a JPEG/black webm while `mediaKind` stayed `"video"`.
2. **expo-av on web** — unreliable with blob/`unmask-media` URIs → `onError` → Image fallback.
3. **Ephemeral `blob:` URLs** — die after reload → decode fails → Image fallback.
4. **Poster overlay** — loading poster could sit on top forever if `ready` never flipped.

**Fix:** never demote video → Image; mount HTML5 `<video>` with muted autoplay; keep poster only until `playing`; reject `data:image` URIs as video sources.

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
