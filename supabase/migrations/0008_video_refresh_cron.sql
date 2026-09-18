-- Daily refresh stand-in for classified video discovery.
--
-- pg_cron is not enabled on every Supabase plan. Do not assume it is on.
-- Testing cadence: once per day, invoke discover-video-content with
--   { "action": "refresh_gaps", "offset": 0 }
-- then 2, 4, … until done=true (two seed products per call),
-- or run `node scripts/refresh-video-discovery.mjs`.
-- Revisit weekly/monthly after testing.
--
-- Cache-first always: refresh only gap-fills pairings under 4 tagged clips.
-- Wilson reorders visible rows; it is not the review gate.
-- VIDEO_REVIEW_ENABLED / app_flags.video_review_enabled MUST be true
-- before public users. No video file download/rehost. Serper only.

do $$
begin
  raise notice 'refresh-video-discovery: use scripts/refresh-video-discovery.mjs or HTTP action=refresh_gaps daily while testing';
end $$;
