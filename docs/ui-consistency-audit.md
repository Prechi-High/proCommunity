# UI consistency audit — 28 October 2026

## Scope and evidence

A source inventory scanned all 89 route modules, including layouts and redirects. 52 route modules depend directly or transitively on the updated visual components. This is a source-level coverage count, not a claim that every authenticated screen was individually tested in a browser.

## Changes

| Area | Concrete improvement |
| --- | --- |
| Ultra Unmask composer | Two-stage story/preview flow; social author identity; readable question field; positive/negative/curiosity prompts; immediate product identity; optional context and timeline attachment; draft persistence including sign-in; disabled/pending feedback; confirmed-post success state. |
| Product picker | Images and brand names; immediate selected-product snapshot; loading, empty and retry states. |
| Settings | Removed nested cards and repeated outlined navigation buttons. Grouped icon rows retain all routes and account actions. |
| Recharge | Consistent pack cards, readable price hierarchy, bolt icons, selected state and order summary. Developer payment-state previews are no longer advertised as consumer actions. Payment processing remains unavailable and labelled. |
| Utility, community and older product pages | Shared app shell with the existing five-item navigation, safe-area/keyboard handling and consistent headings/spacing. |
| Legacy shared controls | Larger tap targets, warm neutral cards, readable field text, quieter secondary actions, haptic/pressed feedback, accessible retry button and full-width skeletons. |
| Profiles and entry | Consistent avatar loading/fallback and more restrained entry headings; back control uses the app icon system. |
| Creator and private operations | Existing role gates and data actions retained. Shared component improvements reach their cards, fields, buttons and status states. |

## Preservation

Home/Community layouts and current product journals keep their established structures. No database schema, wallet pricing, monthly Spark rules, assignment permissions or payment behavior is changed. Original linked questions/experiences and timeline attachments remain in Ultra submissions. Private attachment sharing still uses its existing explicit confirmation.

## Validation

TypeScript, web export, whitespace checks; browser validation of Ultra composition, product tagging, preview/back editing and draft restoration; representative settings/recharge checks. No real community post or financial transaction is created for design QA. Browser checks cannot individually verify private creator/admin pages without an authorized signed-in role; coverage there is through shared components and compilation.

## Source coverage

- app/(auth)/sign-in.tsx
- app/(auth)/verify-email.tsx
- app/(tabs)/index.tsx
- app/(tabs)/saved.tsx
- app/activity.tsx
- app/clarity-settings.tsx
- app/company/[id].tsx
- app/compare.tsx
- app/contribute.tsx
- app/creator/assignment.tsx
- app/creator/earnings.tsx
- app/creator/index.tsx
- app/creator/submit.tsx
- app/creators.tsx
- app/experiences.tsx
- app/help.tsx
- app/investigation/request.tsx
- app/journey/[id]/update.tsx
- app/member/[id].tsx
- app/onboarding/context.tsx
- app/onboarding/interests.tsx
- app/product/[id]/ask-community.tsx
- app/products/add.tsx
- app/products/following.tsx
- app/products/library.tsx
- app/products/timeline.tsx
- app/profile/edit.tsx
- app/profile/people.tsx
- app/profile/questions.tsx
- app/request-product.tsx
- app/results.tsx
- app/routine/[id].tsx
- app/saved-items.tsx
- app/settings/details.tsx
- app/settings/index.tsx
- app/sign-up.tsx
- app/team/creators.tsx
- app/team/finance.tsx
- app/team/index.tsx
- app/team/moderation.tsx
- app/team/ownership.tsx
- app/team/partnerships.tsx
- app/team/research.tsx
- app/team/review.tsx
- app/team/support.tsx
- app/thread/[id].tsx
- app/together.tsx
- app/wallet/history.tsx
- app/wallet/payment.tsx
- app/wallet/purchases.tsx
- app/wallet/recharge.tsx
- app/watch/[id].tsx
