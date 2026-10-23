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

## Remaining acceptance criteria

Fresh end-to-end runs must finish with zero unresolved groups, preserve category evidence, publish a readable UI contract, and include initial API latency in the one-minute measurement. Warm and restored-GPU tests must be reported separately. No universal one-minute guarantee has been established.
