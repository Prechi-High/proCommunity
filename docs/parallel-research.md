# Parallel product research

The production entrypoint now starts a durable research run. A run has at most two video batches of up to 20 eligible videos. Its immutable blueprint describes experience outcomes for the exact product.

Community reports enter before YouTube discovery. Search routes execute concurrently and each receives its own candidate allocation. Video identity is assessed before comment collection. Up to 20 video-page collectors run concurrently, eight comment-review requests run concurrently, and four identity requests run concurrently across the application.

Collectors are code, not LLMs. They persist each raw page and enqueue assessment groups atomically. Each comment receives its own decision even though up to eight decisions share a model request. Duplicate source comments are assessed once per run. Parent/reply context and original quotations are retained. One assessment decides exact-product relevance, category relevance and category-specific sentiment together. Numeric aggregation is deterministic; five is the expansion threshold, never an evidence cap.

After batch one finishes, any category with fewer than five distinct accepted reports triggers batch two. Remaining videos are prioritised toward those gaps while every supported category continues collecting reports. Batch-one results remain visible with category loaders. After batch two, stop even if evidence is sparse.

There is no artificial comment-page cap: per-video page tokens are followed until exhaustion, including reply pages. Provider quota failures and exhausted assessment retries produce an interrupted result with reviewed evidence retained, never a false complete result. A fully harvested/reviewed small sample is complete but has limited confidence.

Queue tables and RPCs are service-role only with RLS. A private per-run token authenticates worker invocations. Database cron retries dispatched/running tasks with expired leases and dispatches eligible work independently of browser activity. Completion results and next-page tasks commit together. Publication uses the existing product presentation and evidence persistence interfaces.

Timing records distinguish fetched from assessed comments. Per-video milestones include the first 100 and 200 top-level threads fetched and the first 100 and 200 comment records assessed, measured from research start. Task-level durations, model token usage, retries and request counts are retained for diagnosis. These milestones are not the same denominator because replies are separate records.

Apply database/parallel-research.sql before deploying research-worker and product-intelligence. The worker authenticates in its handler; product-intelligence retains its existing authentication setting. A one-minute cron provides recovery; normal completions dispatch subsequent tasks immediately.

Verification: run npm run test:parallel-research, npm run test:dynamic-ui, npm run typecheck. The production export runs these checks before packaging the frontend. database/parallel-research-tests.sql runs queue persistence and lease checks inside a rolled-back transaction. Worker selfTest requests require the private run token and exercise pure scheduling and semantic quote validation without model calls.

The 10-second target is not a completion guarantee. Total latency depends on available comments, sequential YouTube pagination, provider capacity, and assessment latency.
