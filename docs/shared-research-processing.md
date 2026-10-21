# Shared research processing

## Deployed architecture

The existing Supabase scheduler remains the only dispatcher. Collection still uses batches of up to 20 eligible videos, with at most two batches. Assessment groups remain eight comments. No 200-comment collection cap was introduced.

Raw comments and parent context remain in `research_comments`. Review tasks represent groups of individually tracked comment decisions, not one upstream request per comment. `research_open` atomically creates a run and its initial tasks. Concurrent callers attach to that run. Interrupted investigations remain readable; an explicit retry resumes saved work instead of deleting its evidence.

`research_dispatch` prioritises verification tasks and round-robins jobs using `last_dispatched_at`. Worker completions nudge the dispatcher immediately; the existing cron job now recovers pending work every ten seconds. Short capacity waits also nudge dispatch after up to five seconds. This does not create a second scheduler.

## Providers

`providers.js` chooses between configured Groq and NVIDIA models using shared database reservations, rather than always calling one then the other. One invocation makes one upstream request. Facts and video identity tasks use the same research-worker governor. Independent invocations may run concurrently on different providers. Other unrelated legacy application endpoints are not migrated by this change.

`research_provider_limits` controls per-provider RPM, TPM, optional daily request/token budgets, concurrency and cooldowns. These are conservative application limits, not verified account entitlements. Reservations include an estimated prompt budget and maximum output budget; successful responses record actual token usage. Each outbound request is retained in `research_provider_usage` with run, task, stage, model, timing, status and usage. No keys or source text are logged there.

Defaults: NVIDIA 30 RPM / 32,000 TPM; Groq 25 RPM / 8,000 TPM / 1,000 requests daily / 200,000 tokens daily; Cloudflare 30 RPM / 32,000 TPM. Adjust these to actual account limits. Cloudflare also enforces its own Neuron allocation, which is not measured by the token governor. More users or workers do not increase provider capacity.

Groq defaults to `openai/gpt-oss-20b`. NVIDIA keeps a supported configured text model, defaulting to `nvidia/nemotron-3.5-lightning-30b-a3b`. Cloudflare defaults to `@cf/meta/llama-3.1-8b-instruct-fp8`. Treat model changes as policy changes and benchmark them.

## Screening and evidence gates

Cloudflare Workers AI is invoked through its REST API from Supabase; a Cloudflare Worker gateway, Queue or Workflow deployment is not required. Screening fails open when unconfigured, unavailable or over budget. Source comments remain stored.

Screening defaults to `shadow`: it runs as a background audit in `research_filter_audits`, without blocking assessment, and every comment still reaches assessment. `enforce` requires both `RESEARCH_FILTER_MODE=enforce` and `RESEARCH_FILTER_APPROVED=true` after evaluating missed useful experiences. Enforced exclusions require an explicit high-confidence spam/unrelated decision; ten percent of proposed exclusions are still assessed for audit. Missing or malformed filter decisions are retained for assessment. Shadow mode has inference cost and should be benchmarked before enforcement.

Primary assessment checks exact-product attribution, firsthand experience, category links, sentiment, and exact quote spans together. Existing semantic validators enforce the source quote and product rules. Proposed accepted decisions create separate verification tasks. Primary results never affect category scores before verification. Missing verification IDs stay unresolved; unrelated or duplicated IDs cannot manufacture accepted evidence.

Validated videos enter collection immediately, up to twenty distinct videos per batch. The first forty ranked candidates are considered in the first wave; remaining candidates are considered only if the second wave is needed. Ranking never replaces exact-product validation. Each validation wave has a ninety-second deadline, after which unresolved videos are flagged instead of blocking collection indefinitely.

A generic selected name without a brand or model (such as Travel Size Body Butter) requires identity confirmation before discovery. Brand names are included in discovery queries.

Stage checkpoints preserve valid per-comment decisions and atomically create verification tasks. A partially failed task retries only missing decisions. Successfully verified evidence may publish even when another record in the same group fails. Source collection and decision processing overlap; no stage waits for all twenty collectors to finish.

Verified decisions and semantic rejections are cached by a hash of identity, blueprint, complete comment and parent context, semantic-review version, routing policy and configured assessment models. The cache is service-role-only, expires after thirty days, and is never used for unverified primary acceptances. Explicit refreshes reuse known sources and raw comment IDs, processing only newly encountered or uncached records; discovery of entirely new videos remains a separate refresh-policy extension.

## Failure handling

Each task stage gets at most two worker attempts: original plus one automatic retry. A durable capacity deferral makes no upstream request and does not consume that retry allowance. `Retry-After` produces a shared provider cooldown; credential/payment failures pause that provider for an hour. An actual failed request remains recorded and consumes an attempt. Other configured providers remain eligible.

Tasks waiting for provider capacity for ninety seconds become resumable failures, retaining their evidence and checkpoints so the report can finish as interrupted rather than load indefinitely. This is not a speed guarantee. Verification is dispatched first and primary reviews leave one concurrent provider slot available for verification. Further throughput depends on actual account budgets and measured model latency.

## Owner setup

In Supabase project `aqdptcuwpneuyzjavjak`, open **Edge Functions → Secrets** and add:

| Secret | Value |
|---|---|
| `GROQ_API_KEY` | A key from your Groq account |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | A token scoped to that account with Workers AI Read and Edit permissions |

Keep the existing NVIDIA key. Optional model overrides are `GROQ_TEXT_MODEL` and `CLOUDFLARE_FILTER_MODEL`. Keep screening in shadow mode initially. These are backend secrets; never use an `EXPO_PUBLIC_` prefix or place them in the app.

After adding the secrets, validate authenticated `providerStatus` and small `providerProbe` requests for each provider, then compare accuracy, quote fidelity, rejected-comment audits, calls, token usage and completion latency on representative products. Groq and Cloudflare were not configured at initial deployment, so their live speed and model quality cannot yet be claimed as verified.

The worker diagnostic branches require the same private per-run token as every other worker request. They expose only configuration booleans, model names and bounded test outcomes, never credential values. A probe can consume one small inference request.

## Operations

New installs apply `database/parallel-research.sql` then the shared-processing migration. Existing projects apply only the migration. Do not also reapply the standalone shared SQL after applying its identical migration.

Tests: `npm run test:parallel-research` (includes provider and stage regressions), `database/shared-research-tests.sql` (transaction rollback), TypeScript, and the existing evidence/domain/blueprint tests. Inspect `research_usage_summary(run_id)` for actual per-provider request counts and tokens.

To disable screening, set `RESEARCH_FILTER_MODE=off`. To disable a new provider, remove its backend secret while keeping the new worker so queued verification tasks remain supported. Do not roll back to a worker that cannot recognise `verify` tasks.


## Timing and October 21 investigation

Task metadata records first start, last start, completion, cumulative processing time and capacity deferrals. The published profile includes `parallelResearch.timings`; provider requests record their own start/finish and returned rate-limit headers. Storage calls also emit operation and duration logs without credentials. Preview publication builds the UI contract in memory; full normalized blueprint persistence happens at final publication only.

The live Carotone Brightening Oil investigation confirmed collection began before identity validation finished: discovery completed 28 seconds after run creation and the first collector started at 34 seconds. Under the then-active provider throttling, the investigation was interrupted after about 11 minutes, with a verified brightening report. That run spanned several deployments, so it is a failure diagnosis, not a clean post-change speed benchmark. Its dominant cost was capacity waiting, including 161 review deferrals; it does not establish a seconds-long full-report guarantee.

Groq returned account headers of 8,000 tokens/minute and 1,000 requests/day. NVIDIA returned HTTP 429 responses. The configured app daily Groq budget was almost exhausted (about 197,000 reserved/recorded tokens of 200,000), which is not proof of an upstream daily limit. More parallel workers cannot bypass these account constraints. Explicit retries reset both validation and capacity wait windows and preserve completed evidence.
