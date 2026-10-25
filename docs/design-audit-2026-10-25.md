# Unmask design audit and rebuild — 25 October 2026

## Goal
Make the two layers of clarity obvious: free community experiences/questions, and supported creator-led Ultra Unmasks. Keep Today, Unmask, Product and You. Cosmetic products lead the visual identity; existing product categories and records remain supported.

## Findings and changes

| Finding from current code/live page | Severity | Change |
|---|---|---|
| Failed remote photos leave large grey covers and overlapping fallback labels | High | Branded packaging fallback, shorter card proportions, avatar initials on image failure and a bundled illustrative hero image |
| Community storage paths are treated as ordinary image URLs | High | Experience images resolve through existing permissioned signed-link API; no storage permissions changed |
| API failures are swallowed as empty lists | High | Feed requests propagate errors; screens offer retry instead of manufacturing an empty success |
| Sample experiences, creators and privately owned products fill real destinations | High | Live feed, creator list and personal shelf use real records. A design sample is available only through an explicit example sheet and is labelled |
| Repeated “lived/why/investigation” wording makes basic actions sound abstract | High | Plain experience/question labels, shorter copy and a distinct Ultra Unmask story invitation |
| Four menus exist but their content does not express the two levels clearly | High | Product discovery hero, three icon-led creation actions, community stream and separate Ultra destination |
| Entire desktop is constrained to a 430px phone frame | Medium | Responsive 1040px outer canvas with a readable 780px content width |
| Most account rows have no meaningful leading icons | Medium | Consistent Phosphor icons, larger touch rows and icon-led creator identities |
| Press feedback is basic and haptics can fire on a cancelled touch | Medium | Brief animated press/release respecting reduced motion; selection haptic fires on activation |
| Interface sound is tied to haptics and native audio overrides silent mode | High | Independent opt-in interface sound, default off, quieter playback and silent-mode respect |
| Sign-in from creation uses an inconsistent return parameter | High | Creation sheet uses returnTo, retaining the intended action |
| Support totals can show zero before they load | Medium | Loading/unavailable values are distinguished from real zero; confirmed totals remain authoritative |
| Creator progress is mostly status text | Medium | Visual four-stage trail based on actual recorded stage; creator selection remains visibly unavailable |

## Design choices
Use actual people and product stories as the interesting content. Wine indicates the deeper creator layer; warm neutral discovery and green community cues separate jobs without introducing new navigation. The bundled skincare bottle is an illustration, not a real reviewed product or proof of an outcome.

Address purchase uncertainty through information and useful next steps. Positive experiences have the same creation path as disappointing experiences. Do not intensify fear, invent social presence, fabricate popularity or promise that a manufacturer will respond.

Spark support retains its established currency/weight and idempotent contribution logic. The editable target, creator assignment and payment-provider availability are not silently changed by a visual redesign. No database tables or production records are deleted.

## Verification
TypeScript, Expo web export and the existing research/domain/support tests are run for this change. Browser checks cover public entry, navigation, empty/error presentation and creation controls after deployment. Native haptics/audio require actual device testing; a desktop web build cannot verify physical vibration or iOS silent-mode behaviour.

## Remaining product work
Real payment-provider checkout and agreed creator payout terms still need their separate implementation. Medical photo interpretation is not added. This change does not certify every legacy screen, SEO route, accessibility criterion or device as complete. The shared controls improve downstream screens, while publishing a defensible product answer still depends on real community content and editorial work.

## Research used
- Apple Human Interface Guidelines: Writing, Feedback and Motion — clear language, proportional acknowledgement and purposeful movement.
- W3C WCAG 2.2: status messages, text spacing, target sizes and interaction animation.
- The existing researched Clarity in motion specification: distinguish tap acknowledgement from authoritative completion; preserve autonomy, useful participation and transparent spending.

These guide design choices rather than prove conversion or retention gains. Validate the next iteration with unfamiliar users and modest Android devices, including the itel A70 class.
