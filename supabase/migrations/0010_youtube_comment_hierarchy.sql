-- Meaningful YouTube comments with parent → reply hierarchy for classifier evidence + UI.

alter table public.youtube_comments
  add column if not exists parent_comment_id text references public.youtube_comments (id) on delete cascade,
  add column if not exists like_count int not null default 0,
  add column if not exists reply_count int not null default 0,
  add column if not exists is_meaningful boolean not null default false,
  add column if not exists evidence_score int not null default 0;

create index if not exists youtube_comments_video_parent
  on public.youtube_comments (youtube_video_id, parent_comment_id);

create index if not exists youtube_comments_meaningful
  on public.youtube_comments (youtube_video_id)
  where is_meaningful = true and parent_comment_id is null;
