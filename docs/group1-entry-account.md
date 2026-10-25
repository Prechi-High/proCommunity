# Group 1 — Entry & account

Routes: `/welcome`, `/sign-up`, `/sign-in`, `/verify-email`, `/onboarding/interests`, `/onboarding/context`.

The first anonymous Today visit opens Welcome; Explore first continues without an account. Existing deep links remain accessible. Settings → Interests & optional context reopens setup.

Email OTP remains the working authentication method. The password illustrations in the references are adapted to a six-digit email-code flow; Google remains visibly unavailable until configured. Account creation captures a display name in memory until verification, with a name prompt after reload. Existing members' names are not overwritten. Return destinations survive verification and setup. Verification uses a synchronous ref guard to prevent duplicate requests. No email was sent during automated validation.

Interests and optional self-described skin type/sensitivity live in the existing owner-only clarity_preferences table. Skipping context preserves existing context. Skipping interests preserves existing interests. Completing either Finish or Skip at the final step records setup completion. Settings allows later changes. Public experience context remains a separate explicit choice; no automatic publishing of private preferences.

Today exposes saved interests as investigation category filters. No automated medical inference or recommendation is added.

Terms and privacy links open existing availability screens; finalized legal documents and Google OAuth remain launch configuration work. This change does not fabricate acceptance of unavailable terms.

Validation: TypeScript, Expo web export and rollback-only SQL tests for own preference persistence, invalid category rejection, anonymous/other-account privacy and cross-account write prevention. Native/browser interaction and actual email delivery still need device testing.
