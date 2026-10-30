# Architecture

Unmask is an Expo 57 app. Web export is `npm run export:web`; Vercel publishes the `dist` directory (`vercel.json`). Native builds use Expo. Product records, evidence, and classified clips live in Supabase Postgres.

Product direction is [`docs/UNMASK-MASTER-PRODUCT-DOCUMENT.md`](docs/UNMASK-MASTER-PRODUCT-DOCUMENT.md). This file describes the system in the repository today. Section 25 of the master document names the frontend as the existing Next.js / React application. The frontend in this repository is Expo Router (React Native and React Native Web) on Expo 57.

## Video discovery

Product video discovery uses the `youtube-fetch` Edge Function and the YouTube Data API. `lib/youtube.ts` loads cached clips first and calls `youtube-fetch` when the cache is thin. `discoverVideosForProduct` in `lib/discoverVideos.ts` follows that YouTube path.

`discover-video-content` is still deployed. The app uses it for review actions (`list_pending`, `approve`, `reject`, `classify_pending`, `vote`). Its Serper search-then-embed action returns `serper_disabled` unless the Edge secret `VIDEO_DISCOVERY_PROVIDER=serper` is set (see `.env.example` and the guard in `supabase/functions/discover-video-content/index.ts`).

## Video analysis worker

`workers/asr` is a Docker/Python worker. The normal path uses existing YouTube captions, title, description, and comments. faster-whisper runs only as a YouTube fallback when that metadata is not enough. The worker does not download video files on the normal path.

Enqueue into that worker happens inside the Serper discover action of `discover-video-content`, and only when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set. That action writes `video_analysis_jobs` and pushes the payload to Upstash (default key `asr:jobs`). When Redis is absent, the same action classifies in the Edge Function with Gemini, then OpenRouter, then NVIDIA. `youtube-fetch` does not enqueue the ASR worker.

```
Expo / Vercel
    │
    ├─ youtube-fetch ──────────────► video_cache
    │
    └─ discover-video-content
           │  review actions always
           │  Serper discover only if VIDEO_DISCOVERY_PROVIDER=serper
           ▼
       Upstash Redis (queue only, when configured)
           │
           ▼
       AWS Fargate worker (workers/asr)
           │  captions → metadata → Whisper fallback
           │  Gemini → OpenRouter → NVIDIA
           ▼
       Supabase Postgres
```

Redis is the queue and a read cache. Postgres is the database.

## Tables and ranking this path uses

- `video_cache` is unique on `(catalog_product_id, source_url)` when a catalog product is set, with a separate unique index on unscoped `source_url` (`supabase/migrations/0006_catalog_product_videos.sql`).
- `youtube_comments` is in `supabase/migrations/0003_satchel_threads_feed.sql`. `category_tag_taxonomy` and `video_feedback` are in `supabase/migrations/0007_classified_videos.sql`. `video_analysis_jobs` is in `supabase/migrations/0009_video_analysis_jobs.sql`.
- Clip ranking uses a Wilson score (`lib/videos.ts`, `lib/taxonomy.ts`, and `wilson_score` in `0007_classified_videos.sql`).
- Default content tags are seven universal tags under `universal_default`: how it works, how to use, what's inside, who it's for, long-term, watch out, and comparisons (`lib/taxonomy.ts`). The product video pane reads those tags (`components/product/VideosPane.tsx`).

## ASR infrastructure

- Terraform for ECR and Fargate is in `infra/aws/asr-worker`. The default region is `eu-west-1`. Example variables set `desired_count = 0` and `enable_schedule = false`.
- The Terraform resource name is `sourced-asr-worker`. That string is the infrastructure identifier.
- `workers/asr/README.md` refers to `.github/workflows/asr-worker.yml`. That workflow file is not in the repository. The workflows under `.github/workflows/` are Modal and nano diagnostic/deploy jobs, each started with `workflow_dispatch`.
- Applying Terraform creates AWS resources. Read the cost table in `workers/asr/README.md` before applying it.
- Worker secrets stay off `EXPO_PUBLIC_*`.

## App shell

Tabs are declared in `app/(tabs)/_layout.tsx`. The visible bar is `components/unmask-ui/MainNav.tsx`: Home, Community, Create, My Products, You. `/unmask` and `/pulse` are tab screens with `href: null`. The master product document's navigation (Today, My Products, Unmask, Community, You) is the product target. The bar listed here is what the code renders today.

Product intelligence research (parallel fetch, classification, and publication) is separate from the ASR worker. See `docs/parallel-research.md` and `docs/shared-research-processing.md`.
