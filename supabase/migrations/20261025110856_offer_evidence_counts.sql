begin;
create function public.unmask_offer_evidence_counts(p_ids text[]) returns table(product_id text,experience_count bigint) language sql stable security invoker set search_path=public,pg_temp as $$ select e.product_id,count(*) from public.clarity_experiences e where e.product_id=any(p_ids[1:150]) and e.visibility='public' and e.moderation_status='visible' group by e.product_id;$$;
revoke all on function public.unmask_offer_evidence_counts(text[]) from public;
grant execute on function public.unmask_offer_evidence_counts(text[]) to anon,authenticated;
commit;
