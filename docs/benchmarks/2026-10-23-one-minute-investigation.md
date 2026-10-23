# One-minute investigation optimization — work in progress

The goal is a complete report, preserving two batches of up to 20 exact-product videos, up to 200 unique comments per video, eight-comment semantic assessments, verification and community evidence. A category below five reports triggers the second batch; five is not a cap.

## Controlled measurements

| Test | Time | Valid decisions | Accepted | Scope |
|---|---:|---:|---:|---|
| A10 baseline, four concurrent requests | 38.14 s | 96/96 | 20 | Primary assessment only |
| H100 eager, four concurrent requests | 31.66 s | 96/96 | 21 | Primary assessment only |
| H100 eager, twelve concurrent requests | 15.25 s | 96/96 | 20 | Primary assessment only |

These are model judgments, not a human-labeled accuracy score. Faster sparse formats were rejected after missing clear experiences. The default remains the existing assessment prompt and quote validation.

## Failures exposed by end-to-end testing

- Cold GPU initialization exceeded 90 seconds. Snapshot warmup and compiled execution are under test; no sub-minute cold-start claim yet.
- A schema allowing fewer decisions produced omissions and retries. Exact decision counts were restored. Video IDs are mapped to reusable local IDs rather than compiling a grammar for every YouTube ID.
- The first new-schema full run was cancelled after a schema regression.
- The second full run took 199.90 seconds and was interrupted: three assessment groups exhausted retries, and two collection tasks were stranded after their database claim outlived the HTTP timeout. Their recovery waited roughly 150 seconds.
- The worker now registers background work before claiming and retrieves its inference configuration in the same authenticated, service-only database claim.

## Changes deployed

- Ordered report writes are buffered and committed in one lease-guarded PostgreSQL transaction; cache invalidation follows the commit.
- Assessment capacity is 40 plus eight verification slots, with a 48-request provider budget. This is application concurrency, not a provider quota guarantee.
- H100 serving is limited to two containers and retains the ten-minute idle shutdown.
- Candidate deployment credentials are made stable across subsequent deployments.

## Additional measurements

- Miss Dior Comforting Body Cream: complete, 19.83 seconds from durable run creation, 24 comments, zero failed tasks. Initial API request was 12.01 seconds; this small case is not representative of a large evidence set.
- CeraVe after background-claim fix: 64.99 seconds internally, interrupted by two truncated assessment groups. No stranded collectors remained.
- Reproduced truncation on a failed group: 3,000 output tokens, 7,834 consecutive whitespace characters. The corrected serving configuration explicitly selects xgrammar and disables optional JSON whitespace.
- Rendering payload: 1,859,436 to 582,463 JSON bytes (68.7% reduction); displayed evidence, category bundles and accepted counts compared equal. Compressed transfer: 454,418 to 170,904 bytes. Measured retrieval 9.47 to 8.73 seconds from the test host, so payload reduction alone did not resolve the full latency.

## Full optimized run and current blocker

A fresh CeraVe run (`minute-cerave-20261023-v4`) completed without any failed tasks:

| Measurement | Result |
|---|---:|
| Initial public API response | 10.294 s |
| Ready observed through the public status API | 56.313 s |
| Final report retrieval | 4.103 s |
| Entire client-visible test flow | **60.416 s** |
| Exact-product videos collected | 20 |
| Unique comments retrieved | 1,392 |
| Accepted, verified reports | 263 |
| Total inference requests | 332 |
| Inference tokens | 426,607 |

Category report counts: hydration 114, skin comfort 88, texture 67, absorption 18, fragrance 5. All categories reached the five-report trigger threshold, so no second collection batch was required in this run. Quote, attribution and independent verification remained enabled. This is not a human-labeled accuracy benchmark.

The subsequent final-publication optimization stores the product payload in the same transaction as its presentation and avoids mirroring a final large profile into the run row. Its persistence was replay-tested successfully against the completed test dataset without inference; its end-to-end latency benefit has **not** been verified. Replay duration was 7.84 s and should not be mistaken for a fresh-product speed result.

Modal then began returning HTTP 404 with the explicit body `modal-http: workspace … is disabled`. Both Modal endpoints rejected requests. This is an account refusal, not a product with no evidence. The exact billing/account cause was not available through the connected credentials. Cold restore and another complete speed test are blocked. Do not claim the one-minute target is achieved.

One bounded probe each: NVIDIA and Groq responded successfully; SiliconFlow returned HTTP 402 with an insufficient-balance message. Normal production routing was not changed to these providers. Their present throughput has not been qualified for the one-minute target.

The worker now recognizes a disabled workspace as permanent, stops automatic retrying of that startup attempt and shows temporary unavailability rather than a prolonged spinner. A public API retry test returned the terminal state in 8.82 seconds. No GPU or API credentials appear in this report.

## Remaining acceptance criteria

Fresh end-to-end runs must finish with zero unresolved groups, preserve category evidence, publish a readable UI contract, and include initial API latency in the one-minute measurement. Warm and restored-GPU tests must be reported separately. No universal one-minute guarantee has been established.

The compiled H100 service uses up to two containers, min zero and a 600-second idle window. Initial deployment preparation was 267.31 seconds; snapshot restoration latency has not yet been measured. GPU cost differs from the former A10 deployment.
