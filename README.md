# Sourced

Buying confidence for skincare — literacy, a explained Confidence Score, and verified-owner experience before any store or price.

This repo is an Expo (web + native) app. V1 runs on a seeded catalog so you can use every shopper flow without Shopify or Supabase credentials. The SQL in `supabase/migrations` is the production schema.

## Run

```bash
npm install
npx expo start --web
```

Expo Go works for iOS/Android from the same command (`npx expo start`).

## First-run path

1. Continue with an email (or `preview@sourced.local` via Google to open the admin queue).
2. Optional skin-type profile or 5-question estimate. Skip is allowed.
3. Shelf → Search → product page (no price) → **Get This Product** → store list.
4. Mark purchased, add to routine, log AM/PM, save progress privately.

## Rules encoded in the code

- `lib/catalog.ts` splits **product** reads from **listing** reads. The product route never loads prices or merchants.
- Confidence Score UI always explains fit, community, and transparency. No bare number.
- Streaks count routine completion only.
- Progress sharing defaults off and is per entry.
- Store sort has no promoted/boosted field.

## Connect Supabase later

Copy `.env.example` to `.env.local`, create a project, run `supabase/migrations/0001_init.sql`, then swap the Zustand store in `lib/store.ts` onto `lib/supabase.ts`.

Shopify OAuth, YouTube cache, and cron jobs belong in `supabase/functions` once a project exists. Do not put Shopify tokens or the service role key in the client.

Background video analysis (captions, then Whisper fallback) lives in `workers/asr`. See `ARCHITECTURE.md` and `workers/asr/README.md`. Do not apply the AWS Terraform until you accept the cost table in that README.

## Brand

Shell `#FBF5F1` · Ink `#2A211D` · Rosewood `#8C3547` · Honey `#D9A441` · Sage `#6E8F73` · General Sans · Phosphor icons.
