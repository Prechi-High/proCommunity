# Auth: Supabase + Resend + Google

Sourced accounts are **Supabase Auth users** (`auth.users`) with a row in `public.profiles`. The app never treats a display name on the device as the account.

## Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **OAuth client ID** (Web).
2. Supabase Dashboard → **Authentication → Providers → Google** → enable, paste Client ID and Secret.
3. **Authentication → URL configuration** — add redirect URLs:
   - `https://<your-production-domain>/callback`
   - `http://localhost:8081/callback` (Expo web dev)
   - `sourced://callback` (native deep link; scheme is `sourced` in `app.json`)

## Resend (auth emails)

Two options (use one):

### A — Custom SMTP (simplest)

Supabase → **Project Settings → Auth → SMTP**:

| Field | Value |
|--------|--------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` |
| Sender | `Sourced <you@yourdomain.com>` (domain verified in Resend) |

Set secrets on the project (not in the Expo app):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (optional, for the hook below)

### B — Send Email hook (this repo)

Deploy the edge function and wire the hook:

```bash
supabase functions deploy auth-send-email --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL="Sourced <auth@yourdomain.com>" SEND_EMAIL_HOOK_SECRET=<random>
```

Dashboard → **Authentication → Hooks → Send Email** → HTTPS endpoint:

`https://<project-ref>.supabase.co/functions/v1/auth-send-email`

Authorization: `Bearer <SEND_EMAIL_HOOK_SECRET>`

## App env (public)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
```

## Member flows in the app

- **Google** — OAuth via Supabase; callback route `/callback`.
- **Email + password** — `signUp` / `signInWithPassword` (stored in Auth).
- **Magic link / confirm / reset** — sent by Resend through Supabase; links land on `/callback`.

Apply migrations `0022`, `0023`, `0024` with `supabase db push`.
