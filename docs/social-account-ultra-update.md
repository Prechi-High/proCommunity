# Social identity, product pages and Ultra Unmask — 28 October 2026

## Delivered behavior

- Comment sheets are read-only previews with one Join conversation action. Full conversation pages own the reply composer and optional attachments, including Ultra Unmasks.
- Ordinary posts have like, comment and share actions. Sparks appear only for requested Ultra Unmasks or posts already linked to one.
- Ultra composer omits brand text; the selected product retains its image and name. Requester identity is distinct from the assigned creator. Ultra cards/details use a restrained gold border/glow.
- Starting an Ultra requires at least 10 Sparks or 1 Thunder Spark. The UI shows balance and an explicit contribution amount. A private database function atomically creates the request and debits its opening support. Direct client inserts are revoked, retries are idempotent, insufficient balance leaves no post. Private attachment checks remain enforced.
- No-balance members can claim the existing monthly 50 Sparks. Recharge is honestly labelled unavailable until payment processing is connected.
- Public avatars retain claimed member rings and link to the public profile. Public identity now has a real-name fallback without exposing email, country, region or private skin context. Followers receive in-app alerts for new public stories/questions/Ultra posts and product updates, respecting subscription preferences.
- Product pages have a follow action, separate experiences/questions/public timelines, named timeline owners, and two distinct compact contribution cards. The duplicate ask-community action is removed.
- Sign-in supports email/password and existing email codes. Registration follows email → verify code → name/username → country/state → password. Location choices use country-region-data 4.1.0 data; states reset when country changes. Passwords are never persisted in draft storage. Profile setup saves name/unique username/private location atomically; Supabase Auth owns passwords.
- Verification emails use the app's wine/neutral visual language and a plain-text alternative. Server email code imports text-only brand constants; it no longer attempts to require PNG UI assets in Node.

## Membership truth

The rotating ring shipped previously is the free Unmasker identity. Founding status has a separate gold ring, visible label and protected entitlement table. It is not granted by self-editable metadata or the interest list. No existing account was automatically promoted. The founding page shows an explicitly labelled design preview; program/payment qualification remains unlaunched.

## Connection audit

- Supabase project is ACTIVE_HEALTHY; email provider enabled, email confirmation required, signup enabled.
- Production Vercel keys are present for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_EMAIL_ADDRESS and AUTH_EMAIL_APP_PASSWORD. Secret values were not printed or exported. No real verification email was sent during QA; delivery credentials were not independently authenticated.
- Google provider remains disabled. Paid Spark checkout remains disconnected.
- Supabase's existing leaked-password protection warning remains; enable in Auth settings if supported by the plan. Existing unrelated advisor findings were not changed.
- The Supabase CLI created the local migration file, but automatic review rejected its subsequent external telemetry. Database deployment and verification used the Supabase connector instead.

## Verification

- TypeScript and Expo web export passed.
- 142 existing research/dynamic-UI tests plus 2 server-email tests passed. Local npm export:web hit an environment IPC restriction in the tsx CLI; the same test files passed via node --import tsx --test, then Expo export passed separately.
- Transactional SQL checks passed and rolled back: opening debit, idempotency, minimum contribution, insufficient funds/no orphan, Thunder debit, blocked direct inserts, blocked anonymous requests, blocked self-granted founding status, public identity privacy, real-name setup and deduplicated follower alerts.
- Browser checks cover public UI and navigation; no real post, payment, account creation or password change is performed as design QA.
