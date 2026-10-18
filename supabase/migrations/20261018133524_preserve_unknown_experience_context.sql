-- Unknown historical context stays unknown after later journey changes.
create or replace view public.unmask_experience_feed with(security_invoker=true) as
select u.id,u.journey_id,u.user_id,u.author_name,u.changed,u.unchanged,u.reaction,u.uncertainty,u.would_rebuy,u.photo_path,u.visibility,u.moderation_status,u.is_demo,u.created_at,
 j.product_id,u.acquisition_snapshot as acquisition,u.started_on_snapshot as started_on,
 u.frequency_snapshot as frequency,u.context_snapshot as context,j.status as product_status,
 c.name as product_name,c.brand,c.image_url,c.category,
 greatest(0,u.created_at::date-coalesce(u.started_on_snapshot,u.created_at::date)) as claimed_days,
 greatest(0,u.created_at::date-j.created_at::date) as documented_days,
 case when u.created_at::date-j.created_at::date>=90 then 'long_term' when u.created_at::date-j.created_at::date>=30 then 'established' else 'early' end as maturity,
 'native-v1-conservative'::text as trust_policy,
 'Coordination has not been independently assessed. Ownership does not establish an unbiased opinion.'::text as trust_explanation,
 (select count(*) from public.unmask_helpful h where h.update_id=u.id) as helpful_count,j.visibility as journey_visibility
from public.unmask_experience_updates u join public.unmask_journeys j on j.id=u.journey_id join public.unmask_catalog c on c.id=j.product_id;
