# Comment-group size experiment — 2026-10-23

Recommendation: retain the production default of eight. This experiment changed no production settings.

The same 96 saved CeraVe comments were evaluated with the exact production primary-assessment prompt, JSON schema and decision validator. The sample contains 24 previously accepted evidence comments and 72 other collected comments. These sampling strata are not independently adjudicated ground truth. Model: Modal unmask-nano (Qwen3-4B), one A10G, warm; four concurrent requests, temperature 0.1, 3,000 maximum output tokens and a 45-second HTTP deadline. No retries. No new YouTube quota was consumed.

| Comments/request | Requests/trial | Trial 1 | Trial 2 | Valid decisions, trial 1 / 2 | Reported tokens, trial 1 / 2 |
|---|---:|---:|---:|---:|---:|
| 8 | 12 | 38.143 s | 39.445 s | 96 / 96 | 19,499 / 19,579 |
| 12 | 8 | 65.176 s | 42.703 s | 84 / 96 | 14,961* / 17,367 |
| 16 | 6 | 45.631 s | 48.603 s | 96 / 96 | 16,156 / 16,126 |
| 24 | 4 | 45.004 s | 37.525 s | 70 / 96 | 10,911* / 14,923 |

*Incomplete workload: one request timed out; its token usage was unavailable. These totals must not be interpreted as full-workload savings. In the first 24-comment trial, another request also left two comments without valid uniquely attributable decisions.

Eight, 16 and 24 ran in forward order, then reverse order. Twelve was tested afterward twice. All use the same comment order and no completed-result cache. Provider prefix caching and model variability may influence repeated results. This is a small primary-assessment experiment, not a full unmask benchmark or an exclusive-hardware utilization measurement.

Sixteen halved request count and reduced mean reported token usage by approximately 17.4%, but mean elapsed time rose from 38.794 to 47.117 seconds (21.5% slower). Twelve and 24 each timed out in one of two trials. The successful 24-comment trial was only slightly faster than the eight-comment trials, with inconsistent decisions.

Decision consistency also changes with grouping. The two eight-comment trials differed on two accept/reject decisions. Sixteen disagreed with the first eight-comment reference on 11 and 14 comments; the complete 24-comment trial disagreed on 13. This does not establish that eight is more accurate: no human-labeled truth set was used. It is insufficient evidence to adopt larger batches for live evidence scoring.

An increase is not a single-constant change: the shared review orchestrator currently caps its internal batch at 12, while the durable processing path requests eight with one call per task. Task creation, orchestration, token budgets, completeness validation and retry recovery must be changed together before testing a live rollout above those limits.

The benchmark runner is `scripts/benchmark-comment-batches.cts`. Supply a private config path through `UNMASK_BENCHMARK_CONFIG`; never commit it. The input JSON contains identity, dimensions and records. Default plan is 8/16/24 then 24/16/8. `UNMASK_BATCH_PLAN='[[1,[12]],[2,[12]]]'` runs the middle option. Only aggregate metrics are committed; source texts, per-comment decisions and credentials remain outside the repository.
