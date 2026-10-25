begin;
alter table public.unmask_subscriptions drop constraint unmask_subscriptions_target_type_check;
alter table public.unmask_subscriptions add constraint unmask_subscriptions_target_type_check check(target_type in('product','person','routine','company','investigation'));
-- Public aggregates only. Raw contribution identities remain protected by RLS.
create function public.unmask_browse_investigations(p_search text default '',p_category text default 'All',p_sort text default 'Recent',p_offset integer default 0) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with totals as(select investigation_id,coalesce(sum(amount) filter(where kind='sparks'),0) sparks,coalesce(sum(amount) filter(where kind='thunder'),0) thunder,count(distinct user_id) supporters from unmask_spark_contributions group by investigation_id),
 rows as(select i.*,p.name product_name,p.image_url product_image,p.category,pp.display_name starter_name,c.display_name creator_name,c.avatar_url creator_avatar,coalesce(t.sparks,0) sparks,coalesce(t.thunder,0) thunder,coalesce(t.supporters,0) supporters
 from unmask_investigations i left join unmask_catalog p on p.id=i.product_id left join unmask_public_profiles pp on pp.user_id=i.user_id left join unmask_creators c on c.user_id=i.creator_id and c.published left join totals t on t.investigation_id=i.id
 where (coalesce(p_category,'All')='All' or lower(p.category)=lower(p_category)) and (coalesce(p_search,'')='' or concat_ws(' ',i.title,i.concern,p.name,p.brand) ilike '%'||left(p_search,200)||'%')
 and (p_sort<>'Following' or exists(select 1 from unmask_subscriptions s where s.user_id=auth.uid() and ((s.target_type='investigation' and s.target_id=i.id::text) or (s.target_type='product' and s.target_id=i.product_id) or (s.target_type='person' and s.target_id in(i.user_id::text,i.creator_id::text)))))
 order by case when p_sort='Most sparked' then coalesce(t.sparks,0)+100*coalesce(t.thunder,0) end desc nulls last,i.created_at desc,i.id
 limit 20 offset greatest(0,least(coalesce(p_offset,0),10000)))
 select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) from rows;
$$;
revoke all on function public.unmask_browse_investigations(text,text,text,integer) from public;
grant execute on function public.unmask_browse_investigations(text,text,text,integer) to anon,authenticated;
commit;
