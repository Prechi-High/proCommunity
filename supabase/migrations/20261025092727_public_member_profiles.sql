begin;
-- Deliberately separate public identity from private account/product context.
create table public.unmask_public_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 display_name text not null check(length(display_name) between 2 and 40),
 handle text not null unique check(handle ~ '^[a-z0-9_]{3,24}$'),
 bio text not null default '' check(length(bio)<=280),
 avatar_url text check(avatar_url is null or avatar_url ~ '^https://'),
 social_links text[] not null default '{}' check(cardinality(social_links)<=5),
 show_support boolean not null default false, show_counts boolean not null default false
);
alter table public.unmask_public_profiles enable row level security;
create policy public_identity_read on public.unmask_public_profiles for select to anon,authenticated using(true);
create policy public_identity_insert on public.unmask_public_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy public_identity_update on public.unmask_public_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select on public.unmask_public_profiles to anon,authenticated;
grant insert,update on public.unmask_public_profiles to authenticated;
-- Only opted-in counts are public; never expose subscription preferences/other targets.
create function public.unmask_profile_counts(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select case when p_id=auth.uid() or exists(select 1 from public.unmask_public_profiles where user_id=p_id and show_counts) then jsonb_build_object('followers',(select count(*) from public.unmask_subscriptions where target_type='person' and target_id=p_id::text),'following',(select count(*) from public.unmask_subscriptions where target_type='person' and user_id=p_id)) else '{}'::jsonb end;
$$;
revoke all on function public.unmask_profile_counts(uuid) from public;
grant execute on function public.unmask_profile_counts(uuid) to anon,authenticated;
-- Relationship lists are private to the account owner.
create function public.unmask_my_people(p_followers boolean) returns table(user_id uuid,display_name text,handle text,bio text,avatar_url text,is_creator boolean) language sql stable security definer set search_path=public,pg_temp as $$
 select u.id,coalesce(p.display_name,c.display_name,'Unmasker'),coalesce(p.handle,c.handle,''),coalesce(p.bio,c.bio,''),coalesce(p.avatar_url,c.avatar_url),c.user_id is not null
 from public.unmask_subscriptions s join auth.users u on u.id::text=case when p_followers then s.user_id::text else s.target_id end
 left join public.unmask_public_profiles p on p.user_id=u.id
 left join public.unmask_creators c on c.user_id=u.id and c.published
 where auth.uid() is not null and s.target_type='person' and case when p_followers then s.target_id=auth.uid()::text else s.user_id=auth.uid() end
 order by coalesce(p.display_name,c.display_name,'Unmasker'),u.id limit 200;
$$;
revoke all on function public.unmask_my_people(boolean) from public,anon;
grant execute on function public.unmask_my_people(boolean) to authenticated;
-- Public recognition never reveals anonymous support or amounts, even to profile owner.
create function public.unmask_profile_support(p_id uuid) returns table(id uuid,title text,status text) language sql stable security definer set search_path=public,pg_temp as $$
 select distinct i.id,i.title,i.status from public.unmask_spark_contributions c join public.unmask_investigations i on i.id=c.investigation_id
 where c.user_id=p_id and c.public_ack and exists(select 1 from public.unmask_public_profiles p where p.user_id=p_id and p.show_support) limit 100;
$$;
revoke all on function public.unmask_profile_support(uuid) from public;
grant execute on function public.unmask_profile_support(uuid) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('unmask-avatars','unmask-avatars',true,2097152,array['image/jpeg','image/png','image/webp']);
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='unmask-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='unmask-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
