# ASR worker — captions first, Whisper last

Python background worker for Sourced video analysis. It does **not** download video files on the normal path. Existing YouTube captions and title/description/comments are enough for most classifications. faster-whisper runs only as a fallback, and only for YouTube, and only when metadata is insufficient.

The worker is independent of your laptop once it runs on AWS Fargate. **No AWS resources have been created yet.** Review cost below and apply Terraform only after you approve.

## Architecture

```
Expo / Vercel  →  discover-video-content (Edge)
                     │
                     ├─ Serper search + official embeds
                     ├─ insert video_cache (dedupe catalog_product_id + source_url)
                     └─ if Upstash is configured: LPUSH asr:jobs
                                │
                     Upstash Redis (queue only)
                                │
                     AWS Fargate worker (this directory)
                                │
                     1. captions (youtube-transcript-api)
                     2. comments + description + title
                     3. ASR audio-only fallback (yt-dlp + FFmpeg + faster-whisper)
                                │
                     Gemini → OpenRouter → NVIDIA classifier
                                │
                     Supabase video_cache + video_tags (content_tags) + video_analysis_jobs
```

Redis is not the database. Supabase is.

## Why Fargate, not Lambda or always-on EC2

| Option | Verdict |
| --- | --- |
| **Lambda** | Unsuitable. faster-whisper + FFmpeg exceed practical package/memory limits; 15-minute cap is tight; cold starts reload the model. |
| **EC2** | Works, but an idle `t3.small` is roughly $15/month even with zero jobs. |
| **ECS/Fargate** | Chosen. Docker + FFmpeg + Python, no GPU, can sit at `desired_count = 0`, optional EventBridge `RunTask` every 5 minutes. |

Region: **eu-west-1** (Ireland). West Africa traffic rides European cables; `eu-west-1` has Fargate, ECR, Budgets, and Secrets Manager. `af-south-1` is farther from Lagos for many routes and is usually more expensive.

## Cost before you create anything

Nothing in `infra/aws/asr-worker` is applied. If you apply it with the defaults (`desired_count = 0`, `enable_schedule = false`):

| Resource | Runs continuously? | Scale to zero? | Typical low-usage cost |
| --- | --- | --- | --- |
| ECR repository | idle storage | yes | ~$0 if image < 500 MB free-tier-ish; otherwise ~$0.10/GB-month |
| ECS cluster | metadata only | yes | $0 |
| Fargate service | **no** at desired_count 0 | yes | $0 |
| EventBridge schedule | only if you set `enable_schedule = true` | disable the rule | ~$0.01–0.04 per 5-minute task start using 0.5 vCPU / 2 GB for a few minutes |
| CloudWatch logs | when tasks run | retention 14 days | first few GB cheap; set retention |
| Secrets Manager | 3 secrets | n/a | ~$0.40/secret/month after free tier |
| NAT Gateway | **not used** | n/a | avoided on purpose (~$32/month). Tasks use a public IP in a public subnet. |
| GPU | not created | n/a | $0 |

Always-on Fargate (desired_count = 1, 0.5 vCPU, 2 GB) is roughly **$15–18/month** in eu-west-1 even with no jobs. Do not turn that on for the MVP.

AWS will **not** stop charges when free tier ends. The Terraform budget alerts at 50% and 100% of `$10` (configurable `$5` / `$10` / `$25`). Alerts do not shut resources off.

### Cost-safety checklist (do this in Console before apply)

1. Enable AWS Billing alerts on the account root email.
2. Create budgets at $5, $10, and $25 (or apply Terraform's single $10 budget plus two extra by hand).
3. Confirm no GPU instance types exist.
4. Keep `desired_count = 0` and `enable_schedule = false` until a test job is ready.
5. Put secrets in Secrets Manager JSON, never in the image or Git.

## Redis job format

```json
{
  "version": 1,
  "jobType": "TRANSCRIBE_VIDEO",
  "jobId": "uuid",
  "videoId": "video_cache.id",
  "productId": "gentle-foaming-cleanser",
  "platform": "youtube",
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "createdAt": "2026-09-19T00:00:00Z",
  "attempt": 1
}
```

Keys (prefix with `:dev` locally):

- `asr:jobs` list
- `asr:processing` list (RPOPLPUSH)
- `asr:delayed` sorted set (retry backoff)
- `asr:dead` list

Backoff: 30s → 2m → 10m. After 3 attempts or a permanent error (`missing_video`, `invalid_url`, …) the job goes to the dead letter list and `video_analysis_jobs.status = dead`.

Idempotency: unique `(video_id, job_type)` in Postgres. If tags already exist with `analysis_status = complete`, the job is acknowledged without re-running Whisper.

## Captions vs ASR

Normal path downloads **zero media**. Captions come from `youtube-transcript-api`.

Audio is fetched **only** when:

1. platform is YouTube, and
2. captions are missing/too short, and
3. title + description + comments are not enough (under 80 characters and no how-to/routine keywords).

Temporary files live in a `asr-*` temp dir and are deleted in a `finally` with `shutil.rmtree`. TikTok/Instagram/Facebook/Pinterest never hit ASR in v1 (no permitted public caption API).

## Taxonomy

The app UI uses seven snake_case keys. Spec aliases such as `HOW_TO_USE` map onto those keys. `UNBOXING` / `OTHER` / `REVIEW` are rejected so the LLM cannot invent chips.

## Local setup

Requires Python 3.11+, FFmpeg on PATH for the ASR fallback, and a **development** Upstash database.

```powershell
cd workers\asr
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
# fill development secrets only; ASR_REDIS_ENV=development
pytest
python worker.py
```

The worker loads `workers/asr/.env` only. It will not read the repo-root `.env`, so it cannot accidentally drain the production queue unless you paste production Redis keys into `workers/asr/.env`.

## Docker

```powershell
cd workers\asr
docker build -t sourced-asr-worker:local .
docker run --rm --env-file .env sourced-asr-worker:local
```

No secrets are baked into the image.

## AWS deploy (after you approve spend)

1. Create three Secrets Manager secrets (JSON) in `eu-west-1`.
2. Copy `infra/aws/asr-worker/terraform.tfvars.example` to `terraform.tfvars` with your VPC public subnets.
3. Review `terraform plan`.
4. `terraform apply` only after you accept the cost table above.
5. Build and push an immutable tag:

```powershell
$ACCOUNT = "<aws-account-id>"
$REGION = "eu-west-1"
$SHA = git rev-parse --short HEAD
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
docker build -t sourced-asr-worker:$SHA workers/asr
docker tag sourced-asr-worker:$SHA "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/sourced-asr-worker:$SHA"
docker push "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/sourced-asr-worker:$SHA"
cd infra/aws/asr-worker
terraform apply -var="image_tag=$SHA" -var="enable_schedule=true"
```

Or run `.github/workflows/asr-worker.yml` with `workflow_dispatch` once GitHub OIDC / AWS secrets exist.

## Shut down

```powershell
cd infra/aws/asr-worker
terraform apply -var="desired_count=0" -var="enable_schedule=false"
# or destroy everything:
terraform destroy
```

Disable the EventBridge rule in Console if Terraform is not in use: ECS → sourced-asr-worker → desired count 0.

## Monitor

CloudWatch log group `/ecs/sourced-asr-worker`. Structured JSON includes `job_id`, `video_id`, `product_id`, `platform`, `processing_stage`, `duration_ms`, `success`. Transcript text, API keys, and Redis tokens are not logged.

## Tests

```powershell
cd workers\asr
pytest
pytest test_captions_integration.py -m integration
```

The integration test uses a public YouTube video with captions. It does not download video files.

## Environment

See `workers/asr/.env.example` and the repo `.env.example`. Frontend may only use `EXPO_PUBLIC_*`. Worker secrets stay server-side.
