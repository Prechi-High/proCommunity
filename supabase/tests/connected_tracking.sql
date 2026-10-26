-- Transaction-only fixtures. No timeline, post, reminder or activity is retained.
begin;
select set_config('test.uid',(select id::text from auth.users limit 1),true),set_config('test.other',gen_random_uuid()::text,true),set_config('test.journey',gen_random_uuid()::text,true),set_config('test.update',gen_random_uuid()::text,true),set_config('test.post',gen_random_uuid()::text,true);
insert into public.unmask_catalog(id,name,brand,category) values('rollback-tracking-test','Rollback tracking product','Test','Skincare');
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
set local role authenticated;
insert into public.unmask_journeys(id,product_id,acquisition,visibility) values(current_setting('test.journey')::uuid,'rollback-tracking-test','purchased','private');
select public.unmask_log_usage(current_setting('test.journey')::uuid,current_setting('test.update')::uuid,'{"body":"My first week with this product.","duration":"Week 1","frequency":"Once a day","skin_type":"Dry","status":"active","reason":"","visibility":"private"}');
select public.unmask_log_usage(current_setting('test.journey')::uuid,current_setting('test.update')::uuid,'{"body":"Retry should not duplicate this observation.","duration":"Week 1","frequency":"Once a day","skin_type":"Dry","status":"active","reason":"","visibility":"private"}');
do $$declare denied boolean:=false;begin
 if (select count(*) from public.unmask_experience_updates where journey_id=current_setting('test.journey')::uuid)<>1 then raise exception 'Usage retry duplicated an update';end if;
 if not exists(select 1 from public.unmask_experience_updates where id=current_setting('test.update')::uuid and usage_duration='Week 1' and frequency_snapshot='Once a day') then raise exception 'Usage context missing';end if;
 begin update public.unmask_journeys set ownership_verified=true where id=current_setting('test.journey')::uuid;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Ownership can be self-verified';end if;
 denied:=false;begin insert into public.clarity_experiences(product_id,duration,body,visibility,attached_journey_id) values('rollback-tracking-test','Week 1','Should not publish a private attachment.','public',current_setting('test.journey')::uuid);exception when others then denied:=true;end;if not denied then raise exception 'Private timeline was attached publicly';end if;
end$$;
insert into public.clarity_experiences(id,product_id,duration,body,visibility) values(current_setting('test.post')::uuid,'rollback-tracking-test','Week 1','Private user experience fixture.','private');
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$begin
 if exists(select 1 from public.unmask_journeys where id=current_setting('test.journey')::uuid) or exists(select 1 from public.unmask_experience_updates where id=current_setting('test.update')::uuid) or exists(select 1 from public.clarity_experiences where id=current_setting('test.post')::uuid) then raise exception 'Private tracking data leaked';end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.uid'),true);
insert into public.unmask_tracking_reminders(journey_id,kind,cadence,time_label,time_zone,next_at) values(current_setting('test.journey')::uuid,'log','weekly','19:00','Africa/Lagos',now()-interval '1 minute');
reset role;
select unmask_private.deliver_tracking_reminders();
do $$begin if (select count(*) from public.unmask_activity where route='/journey/'||current_setting('test.journey'))<>1 then raise exception 'Reminder not delivered';end if;end$$;
update public.unmask_journeys set status='paused' where id=current_setting('test.journey')::uuid;
update public.unmask_tracking_reminders set next_at=now()-interval '1 minute' where journey_id=current_setting('test.journey')::uuid;
select unmask_private.deliver_tracking_reminders();
do $$begin if (select count(*) from public.unmask_activity where route='/journey/'||current_setting('test.journey'))<>1 then raise exception 'Paused product received a reminder';end if;end$$;
select true as tracking_privacy_updates_and_reminders_passed;
rollback;
