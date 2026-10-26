-- Run against a test database with at least two existing auth accounts and a catalog item.
-- All fixtures roll back. No posts, notifications or privacy changes persist.
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true);
select set_config('test.other',(select id::text from auth.users order by created_at offset 1 limit 1),true);
set local role authenticated;
do $$
declare j uuid; p text; own_uid text:=auth.uid()::text; blocked boolean:=false;
begin
 select id into p from public.unmask_catalog limit 1;
 insert into public.unmask_journeys(product_id,status,acquisition,visibility) values(p,'active','purchased','private') returning id into j;
 insert into public.unmask_experience_updates(journey_id,changed,visibility) values(j,'Rollback-only sharing regression note','private');
 begin
  insert into public.unmask_investigations(title,product_id,attached_journey_id) values('Rollback-only attachment test',p,j);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'Private attachment unexpectedly allowed';end if;
 if nullif(current_setting('test.other'),'') is null then raise exception 'A second test account is required';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.other'),true);
 blocked:=false;
 begin perform public.unmask_share_attachment('journey',j);exception when others then blocked:=true;end;
 if not blocked then raise exception 'Non-owner sharing unexpectedly allowed';end if;
 perform set_config('request.jwt.claim.sub',own_uid,true);
 perform public.unmask_share_attachment('journey',j);
 if not exists(select 1 from public.unmask_journeys where id=j and visibility='public') or not exists(select 1 from public.unmask_experience_updates where journey_id=j and visibility='public') then raise exception 'Sharing did not publish source and chapters';end if;
 insert into public.unmask_investigations(title,product_id,attached_journey_id) values('Rollback-only public attachment',p,j);
 insert into public.unmask_questions(product_id,body,audience) values(p,'Rollback-only question for everyone','everyone');
end$$;
rollback;
