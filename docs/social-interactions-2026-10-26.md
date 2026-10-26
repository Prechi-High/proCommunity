# Social interactions and creator updates

Post cards now have accessible 48px action targets for likes, comments, sharing and Sparks. Likes use a spring pop and a fading ring; touch-down compresses the icon. Reduced-motion preferences remove the decorative motion. Device haptics follow the existing user setting. Share opens the device/browser share surface; no fictional share count is shown.

Live likes and comments use RLS-protected tables and an invoker-rights count function. Reads and inserts require a public visible target; user IDs must match the signed-in account. Only the owner can remove their own reaction. Comment bodies are limited to 2,000 characters. Likes use a unique key and idempotent desired-state inserts/deletes, with rollback and error feedback. Existing experience replies and question answers remain the source of their respective conversations. Ultra Unmasks get their own comment thread.

Real Sparks open the existing confirmation and wallet flow. A story without a linked Ultra Unmask offers to take it further instead of inventing a Spark balance. Demo reactions and demo Sparks are saved locally, remain labelled fictional, and never enter paid contribution tables. Linked demo cards and their progress meters share one counter.

Creator updates sit at the top of Today and Unmask. Wine-to-gold rings mark unseen updates; muted rings mark seen updates; dashed inner borders identify profiles without updates. Tapping opens an update sheet with an explicit view/watch action and profile link. Live updates come from published creator videos. Demo progress updates are explicitly labelled. Seen markers are per account/device and based on update IDs, not random badge timers. No automatic playback, artificial urgency, or endless animations.

Validation: TypeScript, Expo web export, 106 existing tests; transaction-only SQL checks for correct counts, unlike, unauthorized likes and anonymous comment rejection. SQL fixtures roll back. Native haptic feel still needs physical-device review.
