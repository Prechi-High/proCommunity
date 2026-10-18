-- Preserve context as it was when an observation was recorded.
alter table unmask_experience_updates add column acquisition_snapshot text,add column frequency_snapshot text,add column context_snapshot text,add column started_on_snapshot date;
create or replace function public.unmask_stamp_contribution() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 new.user_id:=auth.uid();new.created_at:=now();
 if tg_table_name in ('unmask_experience_updates','unmask_questions','unmask_answers') then
 select coalesce(nullif(display_name,''),'Unmasker') into new.author_name from profiles where id=auth.uid();
 new.author_name:=coalesce(new.author_name,'Unmasker');
 end if;
 if tg_table_name='unmask_experience_updates' then
 select acquisition,frequency,context,started_on into new.acquisition_snapshot,new.frequency_snapshot,new.context_snapshot,new.started_on_snapshot
 from unmask_journeys where id=new.journey_id and user_id=auth.uid();
 end if;
 return new;
end $$;
-- Keep the view's column names and order stable for deployed clients.
create or replace view public.unmask_experience_feed with(security_invoker=true) as
select u.id,u.journey_id,u.user_id,u.author_name,u.changed,u.unchanged,u.reaction,u.uncertainty,u.would_rebuy,u.photo_path,u.visibility,u.moderation_status,u.is_demo,u.created_at,
 j.product_id,coalesce(u.acquisition_snapshot,j.acquisition) as acquisition,coalesce(u.started_on_snapshot,j.started_on) as started_on,
 coalesce(u.frequency_snapshot,j.frequency) as frequency,coalesce(u.context_snapshot,j.context) as context,j.status as product_status,
 c.name as product_name,c.brand,c.image_url,c.category,
 greatest(0,u.created_at::date-coalesce(u.started_on_snapshot,j.started_on,u.created_at::date)) as claimed_days,
 greatest(0,u.created_at::date-j.created_at::date) as documented_days,
 case when u.created_at::date-j.created_at::date>=90 then 'long_term' when u.created_at::date-j.created_at::date>=30 then 'established' else 'early' end as maturity,
 'native-v1-conservative'::text as trust_policy,
 'Coordination has not been independently assessed. Ownership does not establish an unbiased opinion.'::text as trust_explanation,
 (select count(*) from public.unmask_helpful h where h.update_id=u.id) as helpful_count,j.visibility as journey_visibility
from public.unmask_experience_updates u join public.unmask_journeys j on j.id=u.journey_id join public.unmask_catalog c on c.id=j.product_id;
