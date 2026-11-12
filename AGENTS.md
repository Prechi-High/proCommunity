# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Design language

Before changing UI, read **`docs/DESIGN_LANGUAGE.md`** and use primitives from `components/lively/` (`AmbientCanvas`, `GlassCard`, `StoryRail`). Tokens live in `constants/design-language.ts`.

## Supabase CLI

Use `SUPABASE_ACCESS_TOKEN` from `.env.local` (never commit it). Run CLI via `node scripts/supabase-cli.mjs …` or `node scripts/deploy-product-intelligence.mjs`. Default project ref: `aqdptcuwpneuyzjavjak`.
