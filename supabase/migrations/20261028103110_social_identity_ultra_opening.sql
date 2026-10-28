begin;
-- Founding status is an earned/admin-granted entitlement, not self-editable metadata or interest.
create table public.unmask_founding_members (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 granted_at timestamptz not null default now()
);
alter table public.unmask_founding_members enable row level security;
revoke all on public.unmask_founding_members from anon,authenticated;
grant select on public.unmask_founding_members to anon,authenticated;
create policy founding_public_read on public.unmask_founding_members for select using(true);

-- Return ONLY deliberately public identity fields; country, skin type and email stay private.
create function unmask_rewards_private.public_identity(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('user_id',p.id,'display_name',coalesce(nullif(pp.display_name,''),p.display_name,'Unmasker'),
 'handle',coalesce(pp.handle,''),'bio',coalesce(pp.bio,''),'avatar_url',coalesce(pp.avatar_url,p.avatar_url),
 'social_links',coalesce(pp.social_links,'{}'::text[]),'show_support',coalesce(pp.show_support,false),'show_counts',coalesce(pp.show_counts,false))
 from public.profiles p left join public.unmask_public_profiles pp on pp.user_id=p.id where p.id=p_id;
$$;
revoke all on function unmask_rewards_private.public_identity(uuid) from public;
grant usage on schema unmask_rewards_private to anon;
grant execute on function unmask_rewards_private.public_identity(uuid) to anon,authenticated;
create function public.unmask_public_identity(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select unmask_rewards_private.public_identity(p_id); $$;
revoke all on function public.unmask_public_identity(uuid) from public;
grant execute on function public.unmask_public_identity(uuid) to anon,authenticated;

-- Persist account setup atomically. Never use user-editable metadata for privileges.
create function unmask_rewards_private.complete_profile(p_name text,p_handle text,p_country text,p_region text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in first';end if;
 if not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Verify your email first';end if;
 if length(trim(p_name)) not between 2 and 40 or p_handle !~ '^[a-z0-9_]{3,24}$' or length(p_country) not between 2 and 100 or length(p_region)>100 then raise exception 'Check your name, username and location';end if;
 update public.profiles set display_name=trim(p_name),country=p_country,region=p_region where id=u;
 insert into public.unmask_public_profiles(user_id,display_name,handle,show_counts) values(u,trim(p_name),p_handle,true)
 on conflict(user_id) do update set display_name=excluded.display_name,handle=excluded.handle;
end; $$;
revoke all on function unmask_rewards_private.complete_profile(text,text,text,text) from public;
grant execute on function unmask_rewards_private.complete_profile(text,text,text,text) to authenticated;
create function public.unmask_complete_profile(p_name text,p_handle text,p_country text,p_region text) returns void
language sql security invoker set search_path='' as $$ select unmask_rewards_private.complete_profile(p_name,p_handle,p_country,p_region); $$;
revoke all on function public.unmask_complete_profile(text,text,text,text) from public;
grant execute on function public.unmask_complete_profile(text,text,text,text) to authenticated;

-- A request cannot exist without its starter's confirmed opening contribution.
alter table public.unmask_investigations add column opening_key uuid;
create unique index ultra_opening_key on public.unmask_investigations(user_id,opening_key) where opening_key is not null;
create function unmask_rewards_private.start_ultra(p_story jsonb,p_kind text,p_amount integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); item public.unmask_investigations; w public.unmask_spark_wallets; pid text:=nullif(p_story->>'product_id',''); qid uuid:=nullif(p_story->>'question_id','')::uuid; eid uuid:=nullif(p_story->>'experience_id','')::uuid;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in to start an Ultra Unmask';end if;
 if p_key is null or p_kind is null or p_kind not in('sparks','thunder') or p_amount is null or p_amount>1000000 or p_amount<(case when p_kind='sparks' then 10 else 1 end) then raise exception 'Start with at least 10 Sparks or 1 Thunder Spark';end if;
 -- Serialize retries before checking the unique key, including concurrent/double-click requests.
 insert into public.unmask_spark_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.unmask_spark_wallets where user_id=u for update;
 select * into item from public.unmask_investigations where user_id=u and opening_key=p_key;
 if found then
 if item.title<>trim(p_story->>'title') or not exists(select 1 from public.unmask_spark_contributions where user_id=u and request_key=p_key and investigation_id=item.id and kind=p_kind and amount=p_amount) then raise exception 'This request reference has already been used';end if;
 return to_jsonb(item);end if;
 if (p_kind='sparks' and w.sparks<p_amount) or (p_kind='thunder' and w.thunder<p_amount) then raise exception 'Not enough Sparks. Claim your monthly 50 or top up your balance.';end if;
 if length(trim(coalesce(p_story->>'title',''))) not between 10 and 160 or length(coalesce(p_story->>'concern',''))>3000 then raise exception 'Write a clear question between 10 and 160 characters';end if;
 if qid is not null and not exists(select 1 from public.unmask_questions where id=qid and product_id=pid and moderation_status='visible' and routine_id is null) then raise exception 'That question is unavailable';end if;
 if eid is not null and not exists(select 1 from public.clarity_experiences where id=eid and product_id=pid and visibility='public' and moderation_status='visible') then raise exception 'That public experience is unavailable';end if;
 insert into public.unmask_investigations(user_id,product_id,question_id,experience_id,title,concern,supporting_links,attached_journey_id,attached_experience_id,opening_key)
 values(u,pid,qid,eid,trim(p_story->>'title'),coalesce(p_story->>'concern',''),'',nullif(p_story->>'attached_journey_id','')::uuid,nullif(p_story->>'attached_experience_id','')::uuid,p_key) returning * into item;
 perform public.contribute_investigation(item.id,p_kind,p_amount,true,p_key);
 return to_jsonb(item);
end; $$;
revoke all on function unmask_rewards_private.start_ultra(jsonb,text,integer,uuid) from public;
grant execute on function unmask_rewards_private.start_ultra(jsonb,text,integer,uuid) to authenticated;
create function public.unmask_start_ultra(p_story jsonb,p_kind text,p_amount integer,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select unmask_rewards_private.start_ultra(p_story,p_kind,p_amount,p_key); $$;
revoke all on function public.unmask_start_ultra(jsonb,text,integer,uuid) from public;
grant execute on function public.unmask_start_ultra(jsonb,text,integer,uuid) to authenticated;
revoke insert on public.unmask_investigations from authenticated;

-- New public posts reach followers; never include private journal/context data.
create function unmask_rewards_private.notify_public_post() returns trigger language plpgsql security definer set search_path='' as $$
declare pid text; destination text; heading text;
begin
 if tg_table_name='clarity_experiences' then
 if new.visibility<>'public' or new.moderation_status<>'visible' then return new;end if;
 destination:='/story/'||new.id;heading:='A person you follow shared a product experience';
 elsif tg_table_name='unmask_questions' then
 if new.routine_id is not null or new.moderation_status<>'visible' then return new;end if;
 destination:='/question/'||new.id;heading:='A person you follow asked a product question';
 else destination:='/investigation/'||new.id;heading:='A person you follow started an Ultra Unmask';end if;
 pid:=new.product_id;
 insert into public.unmask_activity(user_id,kind,title,body,route)
 select s.user_id,'experience',case when bool_or(s.target_type='person') then heading else 'An update about a product you follow' end,coalesce(c.name,'A product story'),destination
 from public.unmask_subscriptions s left join public.unmask_catalog c on c.id=pid
 where s.user_id<>new.user_id and ((s.target_type='product' and s.target_id=pid) or (s.target_type='person' and s.target_id=new.user_id::text))
 and (cardinality(s.preferences)=0 or 'all'=any(s.preferences) or (tg_table_name='unmask_questions' and 'questions'=any(s.preferences)) or (tg_table_name in ('clarity_experiences','unmask_investigations') and 'experiences'=any(s.preferences)))
 group by s.user_id,c.name;
 return new;
end; $$;
revoke all on function unmask_rewards_private.notify_public_post() from public;
create trigger notify_public_experience after insert on public.clarity_experiences for each row execute function unmask_rewards_private.notify_public_post();
create trigger notify_public_question after insert on public.unmask_questions for each row execute function unmask_rewards_private.notify_public_post();
create trigger notify_public_ultra after insert on public.unmask_investigations for each row execute function unmask_rewards_private.notify_public_post();
create or replace function public.unmask_browse_investigations(p_search text default '',p_category text default 'All',p_sort text default 'Recent',p_offset integer default 0) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with totals as(select investigation_id,coalesce(sum(amount) filter(where kind='sparks'),0) sparks,coalesce(sum(amount) filter(where kind='thunder'),0) thunder,count(distinct user_id) supporters from unmask_spark_contributions group by investigation_id),
 rows as(select i.*,p.name product_name,p.image_url product_image,p.category,coalesce(pp.display_name,starter.display_name) starter_name,c.display_name creator_name,c.avatar_url creator_avatar,coalesce(t.sparks,0) sparks,coalesce(t.thunder,0) thunder,coalesce(t.supporters,0) supporters
 from unmask_investigations i left join unmask_catalog p on p.id=i.product_id left join profiles starter on starter.id=i.user_id left join unmask_public_profiles pp on pp.user_id=i.user_id left join unmask_creators c on c.user_id=i.creator_id and c.published left join totals t on t.investigation_id=i.id
 where (coalesce(p_category,'All')='All' or lower(p.category)=lower(p_category)) and (coalesce(p_search,'')='' or concat_ws(' ',i.title,i.concern,p.name,p.brand) ilike '%'||left(p_search,200)||'%')
 and (p_sort<>'Following' or exists(select 1 from unmask_subscriptions s where s.user_id=auth.uid() and ((s.target_type='investigation' and s.target_id=i.id::text) or (s.target_type='product' and s.target_id=i.product_id) or (s.target_type='person' and s.target_id in(i.user_id::text,i.creator_id::text)))))
 order by case when p_sort='Most sparked' then coalesce(t.sparks,0)+100*coalesce(t.thunder,0) end desc nulls last,i.created_at desc,i.id
 limit 20 offset greatest(0,least(coalesce(p_offset,0),10000)))
 select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from rows;
$$;

commit;
