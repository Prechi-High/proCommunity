alter table public.unmask_questions add column skin_type text check(skin_type in('Dry','Oily','Combination','Normal','Sensitive')),add column audience text not null default 'none' check(audience in('none','same_product','same_product_skin','similar_products','similar_products_skin'));
alter table public.clarity_preferences add column product_question_invites boolean not null default true;
-- Recipient identities, counts and private usage never leave this internal function.
create function unmask_private.invite_product_users() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.unmask_catalog;begin
 if new.product_id is null or new.routine_id is not null or new.audience='none' then return new;end if;
 if new.user_id is distinct from auth.uid() then raise exception 'Question owner mismatch';end if;
 if new.audience like '%skin' and new.skin_type is null then raise exception 'Add your skin type to invite a matching audience';end if;
 if (select count(*) from public.unmask_questions where user_id=new.user_id and created_at>now()-interval '1 day' and audience<>'none')>3 then raise exception 'You have reached today’s three audience invitations. Post without an invitation or try tomorrow.';end if;
 select * into p from public.unmask_catalog where id=new.product_id;
 insert into public.unmask_activity(user_id,kind,title,body,route)
 select owners.user_id,'question','Can your experience help someone choose?',
 'Someone is considering '||p.name||' and invited '||case when new.audience in('same_product','same_product_skin') then 'people who have used this product' else 'people who have used this or a similar product' end||case when new.audience like '%skin' then ' with the same skin type' else '' end||'. '||left(new.body,160)||' Your private records were not shared.','/question/'||new.id::text
 from (
 select j.user_id,j.product_id,j.skin_type from public.unmask_journeys j where j.status<>'purchased'
 union all
 select e.user_id,e.product_id,e.skin_type from public.clarity_experiences e where e.moderation_status='visible'
 ) owners
 join public.unmask_catalog c on c.id=owners.product_id
 left join public.clarity_preferences prefs on prefs.user_id=owners.user_id
 where owners.user_id<>new.user_id and coalesce(prefs.product_question_invites,true)
 and (owners.product_id=new.product_id or (new.audience in('similar_products','similar_products_skin') and lower(c.category)=lower(p.category) and nullif(trim(p.category),'') is not null and lower(c.brand)=lower(p.brand) and nullif(trim(p.brand),'') is not null))
 and (new.audience not like '%skin' or coalesce(nullif(owners.skin_type,''),prefs.skin_type)=new.skin_type)
 -- No more than one invitation per recipient per day, across all questions.
 and not exists(select 1 from public.unmask_activity a where a.user_id=owners.user_id and a.kind='question' and a.title='Can your experience help someone choose?' and a.created_at>now()-interval '1 day')
 group by owners.user_id order by owners.user_id limit 40;
 return new;end$$;
revoke all on function unmask_private.invite_product_users() from public,anon,authenticated;
create trigger invite_product_users after insert on public.unmask_questions for each row execute function unmask_private.invite_product_users();
create index question_invite_rate on public.unmask_questions(user_id,created_at) where audience<>'none';
-- Match combined brand/name tokens, not just a literal phrase in one column.
create function public.unmask_find_products(p_query text) returns setof public.unmask_catalog language sql stable security invoker set search_path='' as $$
 select c.* from public.unmask_catalog c
 where length(trim(p_query))>=2 and not exists(
 select 1 from regexp_split_to_table(lower(regexp_replace(left(p_query,160),'[^[:alnum:] ]',' ','g')),' +') token
 where length(token)>0 and position(token in lower(c.name||' '||coalesce(c.brand,'')))=0)
 order by lower(c.name)=lower(trim(p_query)) desc,c.name limit 30;
$$;
revoke all on function public.unmask_find_products(text) from public;
grant execute on function public.unmask_find_products(text) to anon,authenticated;
