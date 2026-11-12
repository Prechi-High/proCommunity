# Unmask design language — **Lively Glass** (v1.0)

This document is the source of truth for product UI. It merges the reference patterns you shared (immersive social feeds, floating glass navigation, story rails, gradient energy) with Unmask’s **vision**: social first, identity proud, timelines as depth — not complaint forms.

**Code tokens:** `constants/design-language.ts` · **Primitives:** `components/lively/*`

When you change UI, read this first. When you add a screen, use the primitives — do not invent one-off styles.

---

## 1. Product north star (from strategy docs)

| Layer | User says | UI job |
|--------|-----------|--------|
| Show me | “This is me right now.” | Photo/video, stories, expressive feed |
| Show what I use | “Check my Unmask.” | Shelf, routine, identity card |
| Show what happened | “This is my journey.” | Timelines, milestones, context |
| Ask (later) | Ultra / seller / rooms | Paused until flags on — never dead-end |

**Habit line (repeat everywhere):** *This is me. This is what I use. This is what happened.*

**First 90:** one product, one timeline, community visible, movement language on marketing — not feature walls.

---

## 2. Design personality

### Feel
- **Lively** — color washes, motion, people-forward imagery, story energy.
- **Sleek** — generous radius, floating layers, calm typography (General Sans).
- **Proud** — users should *want* to screenshot their Unmask, not feel they filed a ticket.

### Social night (current journey)

Dark is the default on every `AppShell` page. Settings → Theme switches to light; ink and muted text follow the theme so both stay readable. Photo captions stay on a dark scrim so they remain readable on the image.

Posts show a skin chip, product, timeline, like count, and comment count. Under the story rings, a horizontal teaser row previews Ask the brand, Ask an expert, and seller audio rooms as locked until after the First 90, plus an enabled Create your store and a small orientation-film card.

Creating a moment opens the in-app Unmask camera (viewfinder, shutter, flip, timer, grid, looks, Unmask stickers). Upload is a small roll button, not the shutter. Teasers under stories are short dashed slips: locked layers read as closed, not as big buttons. Pinning a timeline chooses an existing timeline.

Emotional invites to keep in the feed: shy first post, routine flex, men and grooming, “good for who?”, one product. Preview faces stay labeled as a preview of the room, not live accounts.

### Visual-first rule (non‑negotiable)

Every primary surface (home, welcome, community) must show **people and media first**: story rail, at least one featured post with photography, and a horizontal feed strip. Copy supports the visuals — never a wall of text without images. **Post entry** is `/moment` (camera/gallery/caption), not a blank form. Product and timeline attach are **optional** chips, per the social identity plan.

### What we borrow from references
| Pattern | Reference | Unmask adaptation |
|---------|-----------|-------------------|
| Floating glass dock | Velocity, Famio | Wine-tinted frosted tab bar, elevated center Create |
| Story rail | Famio, Velocity | “Your moment” + community rings atop Community |
| Glass cards | All three | Frosted panels on ambient gradient pages |
| Gradient CTAs | Velocity follow | Wine → rosewood primary actions; gold for Sparks only |
| Layered media | Famio posts | Optional tilt stack on hero marketing cards |
| Full-bleed + scrim | Neon reel mock | Reserved for future story viewer — not default reading UI |

### What we do **not** copy literally
- Full dark/neon gamer UI as default — Unmask stays **light, warm, readable** (wine + cream + soft sage/sky washes).
- Fake engagement counts or synthetic “live” badges.

---

## 3. Color

**Brand (unchanged meaning, livelier application):**
- Wine / rosewood: `#3D0F15` → `#70323E` (actions, wordmark)
- Ink / body: `#1C1917`, muted `#5C534F`
- Gold: `#C9A227` (Sparks, movement, countdown — use sparingly for glow)
- Sage: `#236044` (questions, calm actions)
- Surfaces: cream `#FDFAF7`, mist `#F3F0EE`, line `#E8E2DF`

**Ambient page gradients** (see `livelyGradients`):
- `page` — default app shell (cream + blush whisper)
- `social` — Community tab (sky + blush, Famio-like header energy)
- `cinema` — marketing `/welcome` (deeper wine scrim, cinematic frame)

**Accents (decorative blobs):** low-opacity gold and sage circles behind content (`AmbientCanvas`).

---

## 4. Typography

- **UI:** General Sans (already loaded). Headlines = Semibold/Bold, **no** decorative serif for long reading.
- **Scale:** Hero 32–40, Section 22–26, Body 15–16 / line 22–24, Eyebrow 11–12 with letterspacing 1.2–2.4.
- **Voice in UI:** short, human, identity-forward (“Show your Unmask”, not “Submit experience”).

---

## 5. Shape & space

| Token | Value | Use |
|-------|-------|-----|
| `livelyRadii.card` | 26 | Cards, story tiles |
| `livelyRadii.hero` | 32 | Marketing panels |
| `livelyRadii.button` | 20 | Buttons, inputs |
| `livelyRadii.dock` | 28 | Floating nav island |
| `livelyRadii.story` | 22 | Story rings |
| Section gap | 20–24 | Between blocks |
| Page padding | 20 (24 desktop marketing) | Horizontal |

---

## 6. Glass & depth

**Glass recipe (no blur required on native; `backdrop-filter` on web via `GlassCard`):**
- Fill: `rgba(255,255,255,0.72–0.88)`
- Hairline: `rgba(255,255,255,0.55)` or `colors.line`
- Shadow: soft wine tint, never harsh black (`livelyElevation`)

**Elevation levels:**
1. **Flat** — inline chips
2. **Raised** — feed cards, list rows
3. **Lifted** — floating nav, modals, Create button
4. **Fab** — primary floating actions

---

## 7. Core components (use these)

| Component | Role |
|-----------|------|
| `AmbientCanvas` | Page background gradient + accent blobs |
| `GlassCard` | Any grouped content block |
| `StoryRail` | Horizontal identity/story entry (Community, future stories MVP) |
| `AppShell` | Header + scroll + optional `navigation` dock |
| `MainNav` | Floating glass tab bar |
| `ActionButton` | Gradient primary; glass secondary |
| `StoryCard` | Social feed unit — photo, person, product context |
| `FilterChips` | Glass pills, wine fill when selected |
| `IdentityPrompts` | SHOW YOURSELF quick actions |

---

## 8. Screen patterns

### Community (social home)
1. Ambient `social` gradient  
2. `StoryRail` → Quick actions → Identity prompts  
3. Feed with glass `StoryCard`s  
4. Demo/sample labeled honestly  

### Home (signed-in)
Movement day line + glass search card + shortcuts (timelines, community). Warm, not dashboard-heavy.

### My Unmask (`/products`)
Shelf/journal metaphor — gradient header card, product tiles as glass cards.

### You
Profile hero, stats in glass row, grouped lists on ambient page.

### Marketing `/welcome`
Cinematic layout on wide screens; movement countdown; `CommunityWithUs` — people visible early.

### Paused features (Creator, Rooms, Live, Ultra)
`PausedLayer` on ambient canvas — same glass buttons, link back to Community/search.

---

## 9. Motion & interaction

- Press scale 0.98 on primary controls (respect `useReducedMotion`).
- Haptics on tab change and primary CTA (`hapticSelect`).
- No gratuitous parallax; liveliness comes from **color, photography, and layout**.

---

## 10. Content & ethics

- Label demos: “Design example” / “Sample”.
- No fabricated stats.
- Social first: posting is a **show**, not a form.
- Ultra/creator/rooms hidden via `lib/features.ts` until launched — UI uses PausedLayer.

---

## 11. Implementation checklist (new work)

1. Wrap screen body in `AmbientCanvas` (or use `AppShell` which does this).
2. Group content in `GlassCard` where it is a distinct block.
3. Use `ActionButton` tones — avoid raw `Pressable` fills.
4. Keep navigation via floating `MainNav` on tab routes.
5. Copy from `lib/social/identity.ts` for identity strings.
6. Update this doc if you add a **new pattern** used twice or more.

---

## 12. Roadmap (design vs product)

| Phase | Design focus |
|-------|----------------|
| Now | Glass system, story rail shell, lively feeds |
| Stories MVP | Full-bleed viewer, attach My Unmask card |
| My Unmask card | Shareable identity panel on profile |
| Timelines | Milestone viewer with media progression |

*Version 1.0 — aligned with Social Identity plan + First 90 vision (Nov 2026).*
