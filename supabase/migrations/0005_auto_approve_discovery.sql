-- Temporarily auto-approve web-search discovery. The pending_review column
-- and admin approve/reject actions stay so the gate can be turned back on.

alter table public.video_cache
  alter column pending_review set default false;

update public.video_cache
set pending_review = false
where pending_review = true;
