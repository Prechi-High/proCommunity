# Architecture

Sourced is an Expo 57 app (web on Vercel, native via Expo). Product literacy and classified social clips live in Supabase. Video **search** stays on the `discover-video-content` Edge Function (Serper + official embeds). Video **analysis** is a background worker.

```
Shopper (Expo / Vercel)
        │
        ▼
discover-video-content
        │  cache-first video_cache rows
        ▼
Upstash Redis  ──queue only──►  AWS Fargate ASR worker
                                      │
                         captions → metadata → Whisper
                                      │
                                      ▼
                         Gemini / OpenRouter / NVIDIA
                                      │
                                      ▼
                         Supabase Postgres (source of truth)
```

## What already existed

- Expo Router UI, 7 skincare taxonomy chips, Wilson-score ranking
- `video_cache` unique on `(catalog_product_id, source_url)`
- `category_tag_taxonomy`, `video_feedback`, `youtube_comments`
- Edge classifier (Gemini → OpenRouter → NVIDIA) when Redis is **not** configured
- No Upstash, no AWS worker, no Whisper — until this addition

## What this adds

- `video_analysis_jobs` plus analysis columns on `video_cache`
- Optional enqueue from the Edge Function when `UPSTASH_REDIS_REST_*` are set
- `workers/asr` Docker/Python worker (captions-first, faster-whisper fallback)
- Terraform for ECR + Fargate in **eu-west-1**, default scale-to-zero
- GitHub Actions unit tests; image push is `workflow_dispatch` only

Vercel is unchanged. Do not put worker secrets in `EXPO_PUBLIC_*`.

See `workers/asr/README.md` for cost, local run, and shutdown.
