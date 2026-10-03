# Email OTP authentication (Gmail + Supabase)

Accounts live in **Supabase Auth** (`auth.users`) and `public.profiles`. The app verifies OTPs with `supabase.auth.verifyOtp`. Gmail only delivers the email.

## Environment variables

### Server only (Vercel / `.env.local` — never `EXPO_PUBLIC_`)

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_EMAIL_ADDRESS=
AUTH_EMAIL_APP_PASSWORD=
AUTH_CORS_ORIGINS=https://your-domain.com,http://localhost:8081
AUTH_RATE_LIMIT_PEPPER=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Client (Expo)

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_AUTH_API_URL=https://your-domain.com
```

For native dev on a physical device, set `EXPO_PUBLIC_AUTH_API_URL` to your machine’s LAN IP or deployed Vercel URL (not `localhost`).

## Gmail App Password

1. Google Account → Security → enable **2-Step Verification**.
2. Security → **App passwords** → create one for “Mail”.
3. Set `AUTH_EMAIL_ADDRESS` to your Gmail address and `AUTH_EMAIL_APP_PASSWORD` to the 16-character app password.
4. Never commit `.env` or `.env.local`.

## Supabase

1. `supabase db push` (includes `auth_email_rate_limits` migration).
2. In **Authentication → Providers → Email**, you may disable “Confirm email” for passwordless OTP-only flows, or leave enabled for stricter signup — the app uses `verifyOtp` after the user enters the code.
3. Do **not** configure Supabase SMTP or built-in email hooks if you use the Gmail API route exclusively.

## Deploy

1. Add server env vars in Vercel.
2. Deploy web (`expo export` via existing pipeline).
3. `EXPO_PUBLIC_AUTH_API_URL` should match the deployed origin.

## Test email transport

```bash
npx tsx scripts/test-auth-email.ts --to you@example.com
```

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `AUTH_EMAIL_APP_PASSWORD` to Expo.
- The OTP is never returned from `/api/auth/request-email-code`.
- Only that endpoint can send auth emails (not a generic send-mail API).
