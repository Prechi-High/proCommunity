-- Extend notifications to people and companies, respecting recipients and privacy.
create or replace function public.unmask_notify_event() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare pid text; vis text; owner uuid;
begin
 if tg_table_name='unmask_experience_updates' then
 select product_id,visibility into pid,vis from unmask_journeys where id=new.journey_id;
 if new.visibility<>'public' or vis<>'public' or new.is_demo or new.moderation_status<>'published' then return new; end if;
 insert into unmask_activity(user_id,kind,title,body,route)
 select distinct s.user_id,'experience','A product story has a new chapter',c.name,'/watch/'||pid
 from unmask_subscriptions s join unmask_catalog c on c.id=pid
 where s.user_id<>new.user_id and ((s.target_type='product' and s.target_id=pid)
 or (s.target_type='person' and s.target_id=new.user_id::text) or (s.target_type='company' and s.target_id=c.company_id))
 and (cardinality(s.preferences)=0 or 'all'=any(s.preferences) or 'experiences'=any(s.preferences)
 or ('long_term'=any(s.preferences) and exists(select 1 from unmask_journeys j where j.id=new.journey_id and now()-j.created_at>=interval '90 days')));
 elsif tg_table_name='unmask_questions' then
 if new.routine_id is not null then
 select user_id into owner from routines where id=new.routine_id;
 if owner<>new.user_id then insert into unmask_activity(user_id,kind,title,route) values(owner,'question','Someone asked about your routine','/question/'||new.id); end if;
 return new; end if;
 insert into unmask_activity(user_id,kind,title,body,route)
 select distinct j.user_id,'question','Someone could use your experience','You have a product journey for this product.','/question/'||new.id
 from unmask_journeys j where j.product_id=new.product_id and j.user_id<>new.user_id and j.status<>'purchased';
 elsif tg_table_name='unmask_answers' then
 select user_id into owner from unmask_questions where id=new.question_id;
 if owner<>new.user_id then insert into unmask_activity(user_id,kind,title,route) values(owner,'answer','Your question has a new answer','/question/'||new.question_id); end if;
 end if; return new;
end $$;
create function public.unmask_record_routine_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare who uuid; pname text;
begin
 select user_id into who from routines where id=new.routine_id;
 select name into pname from unmask_catalog where id=new.product_id;
 if tg_op='INSERT' or new.stopped_on is distinct from old.stopped_on or new.step_order is distinct from old.step_order then
 insert into unmask_routine_events(routine_id,user_id,body) values(new.routine_id,who,
 case when tg_op='INSERT' then 'Added '||pname||' to this routine.' when new.stopped_on is not null then 'Stopped using '||pname||' in this routine.' when old.stopped_on is not null then 'Resumed using '||pname||' in this routine.' else 'Changed the order of '||pname||' in this routine.' end);
 end if;
 update routines set updated_at=now() where id=new.routine_id;
 return new;
end $$;
revoke all on function public.unmask_record_routine_change() from public;
create trigger record_routine_item_change after insert or update on unmask_routine_items for each row execute function unmask_record_routine_change();
create function public.unmask_touch_routine() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin update routines set updated_at=now() where id=new.routine_id;return new;end $$;
revoke all on function public.unmask_touch_routine() from public;
create trigger touch_routine_on_update after insert on unmask_routine_events for each row execute function unmask_touch_routine();
