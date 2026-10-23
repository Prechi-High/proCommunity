# Research write batching and publication benchmark

Live run: `6134cc5d-4edc-41a3-98f3-87fa8ea18b23`.
Product: CeraVe Moisturizing Cream; isolated product ID `atomic-cerave-20261023`.
Date: 2026-10-23. API start approximately 14:05 UTC (15:05 Nigeria).

## Deployed changes

- Eight-comment groups commit assessed decisions, cache entries, verification children and task completion in one lease-guarded transaction. Partial responses checkpoint atomically; no empty checkpoint on capacity deferral. Retry cap remains two inference attempts.
- Cache writes use one set-based upsert per group. Successful groups no longer write initial and final checkpoints followed by another completion write.
- Scheduler owns coalesced previews. Final coordinators have an independent dispatch class ahead of previews; pending previews are superseded when the final coordinator is queued. Active publishers remain serialized per product to prevent late preview overwrites.
- Non-facts claims serialize selected run fields directly rather than constructing full profile JSON and deleting it afterward. Publication snapshots omit duplicated comment payloads and assessment rows.
- Provider reservation uses a short transactional lock instead of converting lock contention into repeated one-second deferrals. Daily usage scans are skipped when no daily budget is configured. Successful reservations clear consecutive capacity-wait timers. The consecutive wait deadline is five minutes, distinct from the unchanged two-attempt HTTP retry cap.
- Task summaries record initial queue delay, accumulated provider deferral time and storage request counts. Provider usage records HTTP duration separately from reservation acquisition. Activity counts distinguish queued tasks, capacity-deferred tasks, running workers and outstanding inference reservations; these are not GPU utilization measurements.
- Modal `scaledown_window=600` deployed successfully through Actions run `39965107605`. Minimum replicas remains zero, so a request after idle shutdown can still incur cold startup.

## End-to-end results

| Measurement | Result |
|---|---:|
| Run state | interrupted: one assessment group exhausted two attempts |
| Total until published run update | 277.23 seconds |
| Discovery task processing | 1.14 seconds |
| Warm model readiness task | 0.45 seconds |
| Batch 1 | 20 videos, 1,221 comments |
| Batch 2 | 4 videos, 612 comments |
| Total unique comments | 1,833 |
| Largest retained collection per video | 200 |
| Largest assessment group | 8 |
| Accepted evidence comments | 288 |
| Assessment tasks | 252; 251 done, 1 failed |
| Verification tasks | 159; all done |
| Collection page tasks | 40; all done |
| Identity tasks | 12; all done |
| Coordinator tasks | 6; all done |
| Batch-one publication queue delay | 0.20 seconds |
| Final publication queue delay | 0.37 seconds |
| Final publication processing | 15.02 seconds |
| Assessment HTTP mean | 13.33 seconds, including two 45-second timeouts |
| Verification HTTP mean | 1.74 seconds |
| Assessment reservation acquisition mean | 66.5 milliseconds |
| Recorded assessment/verification storage-error tasks | 0 |
| Capacity-deadline and lease-expiry failures | 0 |
| Final get endpoint | HTTP 200; 10.47 seconds; UI contract and 288 semantic rows present |

Fragrance was below five accepted reports at the batch-one boundary, correctly triggering batch two. All categories exceeded five by the end. Counts: hydration 111, skin comfort 108, texture 65, absorption 20, fragrance 7. Category counts overlap because one comment may support multiple categories and category coverage deduplicates reporters.

The remaining failed group contained eight ordinary-sized comments. Both provider requests reached the 45-second HTTP/transport deadline. This does not establish whether server computation, constrained generation or transport caused that outlier. No extra retries were added to conceal it.

## Concurrency observation

At 20 assessment workers + four verification workers, the 30-second window ending 14:06:56 UTC completed 46 assessment and 28 verification requests. Assessment HTTP mean for that window: 12.88 seconds.

At 14:06:58 UTC the inference reservation ceiling was raised from 24 to 28, permitting 24 assessment workers + four verification workers. The window 14:07:08–14:07:38 completed 47 assessment and 33 verification requests; assessment HTTP mean 14.94 seconds. This is an observational comparison during one run, with different comments, not a controlled equal-input benchmark. The negligible assessment-throughput gain did not justify retaining higher concurrency. Restored 20 assessment workers + four verification workers.

## Comparison limits and validation

The previous run took 791 seconds, collected 1,123 comments from 16 videos in one batch, and had 17 assessment/verification failures. This new run had a warm model and a larger two-batch workload. Do not attribute the entire elapsed-time improvement to write batching or present these as identical-workload A/B tests.

Thirty Node regression checks and TypeScript passed. A live rolled-back SQL test verified batched cache writes, task completion and stale-lease rejection. Snapshot task counts matched the source table. The new commit and snapshot RPCs reject anon access. End-to-end API/database verification passed for report availability, but complete-success and seconds-level latency targets did not pass because of the residual timeout and 277-second elapsed time. Browser click-through was not tested in this benchmark.
