create function public.unmask_social_visible(p_kind text,p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select case p_kind
 when 'experience' then exists(select 1 from public.clarity_experiences where id=p_id and visibility='public' and moderation_status='visible')
 when 'question' then exists(select 1 from public.unmask_questions where id=p_id and routine_id is null and moderation_status='visible')
 when 'unmask' then exists(select 1 from public.unmask_investigations where id=p_id)
 else false end
$$;
revoke all on function public.unmask_social_visible(text,uuid) from public;
grant execute on function public.unmask_social_visible(text,uuid) to anon,authenticated;
create table public.unmask_story_likes(
 target_kind text not null check(target_kind in ('experience','question','unmask')),
 target_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(target_kind,target_id,user_id)
);
alter table public.unmask_story_likes enable row level security;
revoke all on public.unmask_story_likes from anon,authenticated;
grant select on public.unmask_story_likes to anon,authenticated;
grant insert,delete on public.unmask_story_likes to authenticated;
create policy likes_read on public.unmask_story_likes for select to anon,authenticated using(public.unmask_social_visible(target_kind,target_id));
create policy likes_insert on public.unmask_story_likes for insert to authenticated with check(user_id=(select auth.uid()) and public.unmask_social_visible(target_kind,target_id));
create policy likes_delete on public.unmask_story_likes for delete to authenticated using(user_id=(select auth.uid()));
create index unmask_likes_user on public.unmask_story_likes(user_id);
create table public.unmask_story_comments(
 id uuid primary key default gen_random_uuid(),
 investigation_id uuid not null references public.unmask_investigations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','removed')),
 created_at timestamptz not null default now()
);
alter table public.unmask_story_comments enable row level security;
revoke all on public.unmask_story_comments from anon,authenticated;
grant select on public.unmask_story_comments to anon,authenticated;
grant insert(id,investigation_id,user_id,body),delete on public.unmask_story_comments to authenticated;
create policy comments_read on public.unmask_story_comments for select to anon,authenticated using(moderation_status='visible' and public.unmask_social_visible('unmask',investigation_id));
create policy comments_insert on public.unmask_story_comments for insert to authenticated with check(user_id=(select auth.uid()) and moderation_status='visible' and public.unmask_social_visible('unmask',investigation_id));
create policy comments_delete on public.unmask_story_comments for delete to authenticated using(user_id=(select auth.uid()));
create index unmask_comments_story_date on public.unmask_story_comments(investigation_id,created_at);
create index unmask_comments_user on public.unmask_story_comments(user_id);
create function public.unmask_post_stats(p_kind text,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when public.unmask_social_visible(p_kind,p_id) then jsonb_build_object(
 'likes',(select count(*) from public.unmask_story_likes where target_kind=p_kind and target_id=p_id),
 'liked',exists(select 1 from public.unmask_story_likes where target_kind=p_kind and target_id=p_id and user_id=(select auth.uid())),
 'comments',case p_kind when 'experience' then (select count(*) from public.clarity_experience_replies where experience_id=p_id and moderation_status='visible') when 'question' then (select count(*) from public.unmask_answers where question_id=p_id) else (select count(*) from public.unmask_story_comments where investigation_id=p_id) end)
 else null end
$$;
revoke all on function public.unmask_post_stats(text,uuid) from public;
grant execute on function public.unmask_post_stats(text,uuid) to anon,authenticated;
