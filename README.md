# Unmask

**Know before you buy.** Unmask is a product-intelligence platform: community, vetted creators, Live / Room / Ultra realtime modes, a Spark economy, evidence, and AI investigation. Beauty and cosmetics are the initial category. The app is architected for broader product categories.

Product direction is [`docs/UNMASK-MASTER-PRODUCT-DOCUMENT.md`](docs/UNMASK-MASTER-PRODUCT-DOCUMENT.md). That file is the source of truth. The Word original sits next to it: [`docs/UNMASK-MASTER-PRODUCT-DOCUMENT.docx`](docs/UNMASK-MASTER-PRODUCT-DOCUMENT.docx).

This repository is an Expo 57 app. Web is exported for Vercel. Native runs through Expo. The display name in `app.json` is Unmask. The package name and URL scheme still use the older `sourced` slug.

## Run

```bash
npm install
npx expo start --web
```

`npm start` starts the same Expo dev server. `npm run web`, `npm run ios`, and `npm run android` are the platform scripts. Expo Go works for iOS and Android from `npx expo start`.

`npm run export:web` typechecks, runs the parallel-research and dynamic-UI tests, and exports the web bundle (`vercel.json` publishes `dist`).

## App shell

The visible bar is Home, Community, Create, My Products, and You (`components/unmask-ui/MainNav.tsx`). The tab routes also include `/unmask` and `/pulse`; those two are hidden from the bar. Live, Room, and Ultra have their own screens (`/live`, `/room`, `/ultra-unmask`).

The master product document locks a different bottom navigation (Today, My Products, Unmask, Community, You). That document is the product target. The bar above is what the code renders today.

Sign-in uses Supabase Auth (email code or password). Setup is in [`docs/email-auth-setup.md`](docs/email-auth-setup.md).

## Environment

Copy `.env.example` to `.env.local`. Values prefixed `EXPO_PUBLIC_` are bundled into the client. Service role keys, LLM keys, Shopify secrets, and Upstash tokens stay on the server.

Supabase project ref: `aqdptcuwpneuyzjavjak`. Schema changes live in `supabase/migrations` and, where a feature doc says so, `database/`. Deploy Edge Functions with `node scripts/supabase-cli.mjs` or the deploy scripts in `scripts/`. Load `SUPABASE_ACCESS_TOKEN` from `.env.local`. Do not commit it. Agent notes are in [`AGENTS.md`](AGENTS.md).

Photo identification uses the `product-vision` Edge Function. See [`SETUP_IMAGE_RECOGNITION.md`](SETUP_IMAGE_RECOGNITION.md).

Background video analysis (captions, then a Whisper fallback) lives in `workers/asr`. See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`workers/asr/README.md`](workers/asr/README.md). Do not apply the AWS Terraform until you accept the cost table in that README.

## Where to read next

- Current system shape: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- WhatsApp Research Cards: [`docs/integrations/whatsapp/README.md`](docs/integrations/whatsapp/README.md)
- Parallel product research: [`docs/parallel-research.md`](docs/parallel-research.md)
- Shared research processing: [`docs/shared-research-processing.md`](docs/shared-research-processing.md)
