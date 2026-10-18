-- Additive main-product domains. No launch data, rewards or fabricated activity.
create table public.unmask_companies (
 id text primary key, name text not null, parent_id text references public.unmask_companies(id),
 description text, website text, country text, support_url text, logo_url text,
 verification_status text not null default 'unverified' check(verification_status in ('unverified','verified')),
 created_at timestamptz not null default now()
);
create table public.unmask_catalog (
 id text primary key, catalog_product_id uuid references public.products(id),
 name text not null, brand text, category text, image_url text,
 company_id text references public.unmask_companies(id), market text, formulation text,
 created_at timestamptz not null default now()
);
-- Backfill only facts already stored in the product systems. No company verification is inferred.
insert into public.unmask_companies(id,name)
select distinct on (lower(trim(brand))) lower(trim(brand)), trim(brand) from public.product_intel
where nullif(trim(brand),'') is not null and lower(trim(brand)) not in ('unknown','unbranded');
insert into public.unmask_catalog(id,name,brand,category,image_url,company_id)
select id,name,brand,category,hero_image_url,case when lower(trim(brand)) in (select id from public.unmask_companies) then lower(trim(brand)) end
from public.product_intel;
update public.unmask_catalog c set catalog_product_id=p.id from public.products p
where lower(trim(p.name))=lower(trim(c.name)) and lower(coalesce(p.brand,''))=lower(coalesce(c.brand,''));
create table public.unmask_subscriptions (
 user_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('product','person','routine','company')),
 target_id text not null, preferences text[] not null default '{long_term,questions}',
 created_at timestamptz not null default now(), primary key(user_id,target_type,target_id)
);
create index unmask_subscriptions_target on public.unmask_subscriptions(target_type,target_id);
create function public.unmask_can_view(owner_id uuid, visibility text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select owner_id=auth.uid() or visibility='public' or (visibility='followers' and exists(
 select 1 from public.unmask_subscriptions where user_id=auth.uid() and target_type='person' and target_id=owner_id::text));
$$;
revoke all on function public.unmask_can_view(uuid,text) from public;
grant execute on function public.unmask_can_view(uuid,text) to anon,authenticated;
create table public.unmask_journeys (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 product_id text not null references public.unmask_catalog(id),
 status text not null default 'active' check(status in ('purchased','active','paused','finished','stopped','replaced','repurchased')),
 acquisition text not null check(acquisition in ('purchased','gifted','sample','brand_supplied','content_exchange','other')),
 started_on date, stopped_on date, frequency text, goal text, context text, stop_reason text,
 replacement_id text references public.unmask_catalog(id),
 visibility text not null default 'private' check(visibility in ('private','followers','public')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,product_id), check(stopped_on is null or started_on is null or stopped_on>=started_on), check(started_on is null or started_on<=current_date)
);
create index unmask_journeys_product on public.unmask_journeys(product_id);
create table public.unmask_experience_updates (
 id uuid primary key default gen_random_uuid(), journey_id uuid not null references public.unmask_journeys(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 author_name text not null default 'Unmasker', changed text not null check(length(trim(changed)) between 10 and 4000),
 unchanged text, reaction text, uncertainty text, would_rebuy boolean,
 photo_path text, visibility text not null default 'private' check(visibility in ('private','followers','public')),
 moderation_status text not null default 'published' check(moderation_status in ('published','held','removed')),
 is_demo boolean not null default false, created_at timestamptz not null default now()
);
create index unmask_updates_journey on public.unmask_experience_updates(journey_id,created_at desc);
alter table public.routines add column name text not null default 'My routine', add column goal text,
 add column context text, add column uncertainty text, add column started_on date default current_date,
 add column visibility text not null default 'private' check(visibility in ('private','followers','public'));
alter table public.routines drop constraint routines_time_of_day_check;
alter table public.routines add constraint routines_time_of_day_check check(time_of_day in ('am','pm','weekly','travel','recovery'));
create table public.unmask_routine_items (
 id uuid primary key default gen_random_uuid(), routine_id uuid not null references public.routines(id) on delete cascade,
 product_id text not null references public.unmask_catalog(id), step_order integer not null default 0,
 frequency text, started_on date default current_date, stopped_on date,
 unique(routine_id,product_id)
);
create table public.unmask_routine_events (
 id uuid primary key default gen_random_uuid(), routine_id uuid not null references public.routines(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 10 and 2000), created_at timestamptz not null default now()
);
create table public.unmask_questions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 author_name text not null default 'Unmasker', product_id text references public.unmask_catalog(id),
 routine_id uuid references public.routines(id) on delete cascade,
 body text not null check(length(trim(body)) between 10 and 2000), context text,
 created_at timestamptz not null default now(), check(product_id is not null or routine_id is not null)
);
create table public.unmask_answers (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.unmask_questions(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 author_name text not null default 'Unmasker', duration text not null, context text not null,
 acquisition text not null, body text not null check(length(trim(body)) between 10 and 4000), uncertainty text,
 created_at timestamptz not null default now()
);
create table public.unmask_helpful (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 update_id uuid not null references public.unmask_experience_updates(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,update_id)
);
create table public.unmask_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 200), brand text, category text not null default 'skincare',
 status text not null default 'requested' check(status in ('requested','researching','available')),
 product_id text references public.unmask_catalog(id), created_at timestamptz not null default now(), unique(user_id,name,brand)
);
create table public.unmask_activity (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null, title text not null, body text, route text, read_at timestamptz, created_at timestamptz not null default now()
);
create index unmask_activity_user on public.unmask_activity(user_id,created_at desc);
-- Shared reads never grant access to the owner's profile/email/private history.
alter table public.unmask_companies enable row level security;
alter table public.unmask_catalog enable row level security;
create policy companies_read on public.unmask_companies for select using(true);
create policy catalog_read on public.unmask_catalog for select using(true);
-- Authenticated product registration is a narrow RPC, not a general public catalogue write.
create function public.unmask_register_product(p_id text,p_name text,p_brand text default '',p_category text default '',p_image text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b text:=lower(trim(p_brand));
begin
 if auth.uid() is null then raise exception 'Sign in to add a product'; end if;
 if length(p_id) not between 1 and 150 or length(trim(p_name)) not between 1 and 200 then raise exception 'Invalid product'; end if;
 if b<>'' and b not in ('unknown','unbranded') then insert into unmask_companies(id,name) values(b,left(trim(p_brand),200)) on conflict do nothing; end if;
 insert into unmask_catalog(id,name,brand,category,image_url,company_id)
 values(p_id,left(p_name,200),left(p_brand,200),left(p_category,80),case when p_image ~ '^https://' then p_image end,
 case when exists(select 1 from unmask_companies where id=b) then b end) on conflict do nothing;
end $$;
revoke all on function public.unmask_register_product(text,text,text,text,text) from public;
grant execute on function public.unmask_register_product(text,text,text,text,text) to authenticated;
alter table public.unmask_subscriptions enable row level security;
create policy subscriptions_own on public.unmask_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.unmask_journeys enable row level security;
create policy journeys_own on public.unmask_journeys for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy journeys_shared on public.unmask_journeys for select using(public.unmask_can_view(user_id,visibility));
alter table public.unmask_experience_updates enable row level security;
create policy updates_own_read on public.unmask_experience_updates for select using(user_id=auth.uid());
create policy updates_shared on public.unmask_experience_updates for select using(
 not is_demo and moderation_status='published' and public.unmask_can_view(user_id,visibility)
 and exists(select 1 from public.unmask_journeys j where j.id=journey_id and public.unmask_can_view(j.user_id,j.visibility)));
create policy updates_insert on public.unmask_experience_updates for insert to authenticated with check(
 user_id=auth.uid() and not is_demo and moderation_status='published' and exists(select 1 from unmask_journeys j where j.id=journey_id and j.user_id=auth.uid()));
create policy updates_delete on public.unmask_experience_updates for delete to authenticated using(user_id=auth.uid());
create policy routines_shared on public.routines for select using(public.unmask_can_view(user_id,visibility));
alter table public.unmask_routine_items enable row level security;
create policy items_read on public.unmask_routine_items for select using(exists(select 1 from routines r where r.id=routine_id));
create policy items_own on public.unmask_routine_items for all to authenticated using(exists(select 1 from routines r where r.id=routine_id and r.user_id=auth.uid())) with check(exists(select 1 from routines r where r.id=routine_id and r.user_id=auth.uid()));
alter table public.unmask_routine_events enable row level security;
create policy routine_events_read on public.unmask_routine_events for select using(exists(select 1 from routines r where r.id=routine_id));
create policy routine_events_insert on public.unmask_routine_events for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from routines r where r.id=routine_id and r.user_id=auth.uid()));
alter table public.unmask_questions enable row level security;
create policy questions_read on public.unmask_questions for select using(routine_id is null or exists(select 1 from routines r where r.id=routine_id));
create policy questions_insert on public.unmask_questions for insert to authenticated with check(user_id=auth.uid() and (routine_id is null or exists(select 1 from routines r where r.id=routine_id)));
create policy questions_delete on public.unmask_questions for delete to authenticated using(user_id=auth.uid());
alter table public.unmask_answers enable row level security;
create policy answers_read on public.unmask_answers for select using(exists(select 1 from unmask_questions q where q.id=question_id));
create policy answers_insert on public.unmask_answers for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from unmask_questions q where q.id=question_id));
create policy answers_delete on public.unmask_answers for delete to authenticated using(user_id=auth.uid());
alter table public.unmask_helpful enable row level security;
create policy helpful_read on public.unmask_helpful for select using(exists(select 1 from unmask_experience_updates u where u.id=update_id));
create policy helpful_insert on public.unmask_helpful for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from unmask_experience_updates u where u.id=update_id and u.user_id<>auth.uid()));
create policy helpful_delete on public.unmask_helpful for delete to authenticated using(user_id=auth.uid());
alter table public.unmask_requests enable row level security;
create policy requests_own_read on public.unmask_requests for select to authenticated using(user_id=auth.uid());
create policy requests_insert on public.unmask_requests for insert to authenticated with check(user_id=auth.uid() and status='requested' and product_id is null);
alter table public.unmask_activity enable row level security;
create policy activity_read on public.unmask_activity for select to authenticated using(user_id=auth.uid());
create policy activity_update on public.unmask_activity for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Source metadata is server stamped. Backdated start dates do not backdate observed history.
create function public.unmask_stamp_contribution() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.user_id:=auth.uid(); new.created_at:=now();
 if tg_table_name in ('unmask_experience_updates','unmask_questions','unmask_answers') then
 select coalesce(nullif(display_name,''),'Unmasker') into new.author_name from profiles where id=auth.uid();
 new.author_name:=coalesce(new.author_name,'Unmasker');
 end if;
 return new;
end $$;
revoke all on function public.unmask_stamp_contribution() from public;
create trigger stamp_update before insert on unmask_experience_updates for each row execute function unmask_stamp_contribution();
create trigger stamp_question before insert on unmask_questions for each row execute function unmask_stamp_contribution();
create trigger stamp_answer before insert on unmask_answers for each row execute function unmask_stamp_contribution();
create trigger stamp_journey before insert on unmask_journeys for each row execute function unmask_stamp_contribution();
create trigger stamp_routine_event before insert on unmask_routine_events for each row execute function unmask_stamp_contribution();
-- Versioned, conservative trust classifications. No invented numeric certainty.
create view public.unmask_experience_feed with(security_invoker=true) as
select u.*, j.product_id,j.acquisition,j.started_on,j.frequency,j.context,j.status as product_status,
 c.name as product_name,c.brand,c.image_url,c.category,
 greatest(0,current_date-coalesce(j.started_on,current_date)) as claimed_days,
 greatest(0,current_date-j.created_at::date) as documented_days,
 case when current_date-j.created_at::date>=90 then 'long_term' when current_date-j.created_at::date>=30 then 'established' else 'early' end as maturity,
 'native-v1-conservative'::text as trust_policy,
 'Coordination has not been independently assessed. Ownership does not establish an unbiased opinion.'::text as trust_explanation,
 (select count(*) from public.unmask_helpful h where h.update_id=u.id) as helpful_count
from public.unmask_experience_updates u join public.unmask_journeys j on j.id=u.journey_id join public.unmask_catalog c on c.id=j.product_id;
-- Candidate notifications contain no private experience text. Access is checked again when opened.
create function public.unmask_notify_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare pid text; vis text; owner uuid;
begin
 if tg_table_name='unmask_experience_updates' then
 select product_id,visibility into pid,vis from unmask_journeys where id=new.journey_id;
 if new.visibility<>'public' or vis<>'public' or new.is_demo or new.moderation_status<>'published' then return new; end if;
 insert into unmask_activity(user_id,kind,title,body,route)
 select distinct s.user_id,'experience','A product story has a new chapter',c.name,'/watch/'||pid
 from unmask_subscriptions s join unmask_catalog c on c.id=pid
 where s.target_type='product' and s.target_id=pid and s.user_id<>new.user_id
 and (cardinality(s.preferences)=0 or 'all'=any(s.preferences) or 'experiences'=any(s.preferences)
 or ('long_term'=any(s.preferences) and exists(select 1 from unmask_journeys j where j.id=new.journey_id and now()-j.created_at>=interval '90 days')));
 elsif tg_table_name='unmask_questions' then
 if new.routine_id is not null then return new; end if;
 insert into unmask_activity(user_id,kind,title,body,route)
 select distinct j.user_id,'question','Someone could use your experience','You have a product journey for this product.','/question/'||new.id
 from unmask_journeys j where j.product_id=new.product_id and j.user_id<>new.user_id and j.status<>'purchased';
 elsif tg_table_name='unmask_answers' then
 select user_id into owner from unmask_questions where id=new.question_id;
 if owner<>new.user_id then insert into unmask_activity(user_id,kind,title,route) values(owner,'answer','Your question has a new answer','/question/'||new.question_id); end if;
 end if; return new;
end $$;
revoke all on function public.unmask_notify_event() from public;
create trigger notify_experience after insert on unmask_experience_updates for each row execute function unmask_notify_event();
create trigger notify_question after insert on unmask_questions for each row execute function unmask_notify_event();
create trigger notify_answer after insert on unmask_answers for each row execute function unmask_notify_event();
-- Request completion is an internal/admin action; users cannot promote their requests.
create function public.unmask_notify_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='available' and old.status<>'available' and new.product_id is not null then
 insert into unmask_activity(user_id,kind,title,body,route) values(new.user_id,'request','Your requested product is ready',new.name,'/watch/'||new.product_id);
 end if; return new;
end $$;
revoke all on function public.unmask_notify_request() from public;
create trigger notify_request after update on unmask_requests for each row execute function unmask_notify_request();
-- Private media uses signed URLs, never public bucket URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('experience-history','experience-history',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict do nothing;
create policy experience_photo_insert on storage.objects for insert to authenticated with check(bucket_id='experience-history' and (storage.foldername(name))[1]=auth.uid()::text);
create policy experience_photo_owner on storage.objects for select to authenticated using(bucket_id='experience-history' and (storage.foldername(name))[1]=auth.uid()::text);
create policy experience_photo_shared on storage.objects for select using(bucket_id='experience-history' and exists(select 1 from public.unmask_experience_updates u where u.photo_path=name));
create policy experience_photo_delete on storage.objects for delete to authenticated using(bucket_id='experience-history' and (storage.foldername(name))[1]=auth.uid()::text);
revoke all on unmask_companies,unmask_catalog,unmask_subscriptions,unmask_journeys,unmask_experience_updates,unmask_routine_items,unmask_routine_events,unmask_questions,unmask_answers,unmask_helpful,unmask_requests,unmask_activity,unmask_experience_feed from anon,authenticated;
grant select on unmask_companies,unmask_catalog,unmask_experience_feed,unmask_experience_updates,unmask_journeys,routines,unmask_routine_items,unmask_routine_events,unmask_questions,unmask_answers,unmask_helpful to anon,authenticated;
grant select,insert,update,delete on unmask_subscriptions,unmask_journeys,unmask_routine_items to authenticated;
grant insert,delete on unmask_experience_updates,unmask_questions,unmask_answers,unmask_helpful to authenticated;
grant insert on unmask_routine_events,unmask_requests to authenticated;
grant select on unmask_requests,unmask_activity to authenticated;
grant update(read_at) on unmask_activity to authenticated;
grant insert,update,delete on routines to authenticated;
-- Protect observed-history timestamps against client rewrites.
revoke update on unmask_journeys from authenticated;
grant update(status,acquisition,started_on,stopped_on,frequency,goal,context,stop_reason,replacement_id,visibility,updated_at) on unmask_journeys to authenticated;
create or replace view public.unmask_experience_feed with(security_invoker=true) as
select u.*, j.product_id,j.acquisition,j.started_on,j.frequency,j.context,j.status as product_status,
 c.name as product_name,c.brand,c.image_url,c.category,
 greatest(0,current_date-coalesce(j.started_on,current_date)) as claimed_days,
 greatest(0,current_date-j.created_at::date) as documented_days,
 case when current_date-j.created_at::date>=90 then 'long_term' when current_date-j.created_at::date>=30 then 'established' else 'early' end as maturity,
 'native-v1-conservative'::text as trust_policy,
 'Coordination has not been independently assessed. Ownership does not establish an unbiased opinion.'::text as trust_explanation,
 (select count(*) from public.unmask_helpful h where h.update_id=u.id) as helpful_count,
 j.visibility as journey_visibility
from public.unmask_experience_updates u join public.unmask_journeys j on j.id=u.journey_id join public.unmask_catalog c on c.id=j.product_id;
create function public.unmask_sync_catalog() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare b text:=lower(trim(new.brand));
begin
 if nullif(b,'') is not null and b not in ('unknown','unbranded') then
 insert into unmask_companies(id,name) values(b,trim(new.brand)) on conflict do nothing; end if;
 insert into unmask_catalog(id,name,brand,category,image_url,company_id) values(new.id,new.name,new.brand,new.category,new.hero_image_url,
 case when exists(select 1 from unmask_companies where id=b) then b end)
 on conflict(id) do update set name=excluded.name,brand=excluded.brand,category=excluded.category,image_url=excluded.image_url,company_id=excluded.company_id;
 return new;
end $$;
revoke all on function public.unmask_sync_catalog() from public;
create trigger sync_living_catalog after insert or update of name,brand,category,hero_image_url on product_intel for each row execute function unmask_sync_catalog();
create function public.unmask_notify_routine_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into unmask_activity(user_id,kind,title,body,route)
 select s.user_id,'routine','A routine you follow has an update',r.name,'/routine/'||r.id
 from unmask_subscriptions s join routines r on r.id=new.routine_id
 where s.target_type='routine' and s.target_id=r.id::text and s.user_id<>new.user_id
 and (r.visibility='public' or (r.visibility='followers' and exists(select 1 from unmask_subscriptions f where f.user_id=s.user_id and f.target_type='person' and f.target_id=r.user_id::text)));
 return new;
end $$;
revoke all on function public.unmask_notify_routine_event() from public;
create trigger notify_routine_update after insert on unmask_routine_events for each row execute function unmask_notify_routine_event();
