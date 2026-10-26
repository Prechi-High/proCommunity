-- Public conversation attachments retain references and obey source visibility.
alter table public.unmask_investigations
 add column attached_journey_id uuid references public.unmask_journeys(id) on delete set null,
 add column attached_experience_id uuid references public.clarity_experiences(id) on delete set null;
create trigger validate_ultra_attachment before insert or update on public.unmask_investigations
 for each row execute function public.unmask_validate_attachment();
create index investigations_attached_journey on public.unmask_investigations(attached_journey_id) where attached_journey_id is not null;
create index investigations_attached_experience on public.unmask_investigations(attached_experience_id) where attached_experience_id is not null;

-- Only visibility is editable here; author, moderation, notes and photo paths remain protected.
grant update(visibility) on public.unmask_experience_updates to authenticated;
create policy updates_own_visibility on public.unmask_experience_updates for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.unmask_share_attachment(p_kind text,p_id uuid) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to share your experience';end if;
 if p_kind='journey' then
   perform 1 from public.unmask_journeys where id=p_id and user_id=auth.uid() for update;
   if not found then raise exception 'Only the owner can share this timeline';end if;
   update public.unmask_journeys set visibility='public',updated_at=now() where id=p_id and user_id=auth.uid();
   update public.unmask_experience_updates set visibility='public'
    where journey_id=p_id and user_id=auth.uid() and moderation_status='published' and not is_demo;
 elsif p_kind='experience' then
   update public.clarity_experiences set visibility='public'
    where id=p_id and user_id=auth.uid() and moderation_status='visible';
   if not found then raise exception 'Only the author can share an available experience';end if;
 else raise exception 'Choose a timeline or experience';end if;
end$$;
revoke all on function public.unmask_share_attachment(text,uuid) from public,anon;
grant execute on function public.unmask_share_attachment(text,uuid) to authenticated;

alter table public.unmask_questions drop constraint unmask_questions_audience_check;
alter table public.unmask_questions add constraint unmask_questions_audience_check
 check(audience in('none','everyone','everyone_skin','same_product','same_product_skin','similar_products','similar_products_skin'));
alter table public.unmask_questions alter column audience set default 'everyone';
-- Internal routing uses private context, never returns member identities or ownership records.
create or replace function unmask_private.invite_product_users() returns trigger
 language plpgsql security definer set search_path='' as $$
declare p public.unmask_catalog;begin
 if new.product_id is null or new.routine_id is not null or new.audience in('none','everyone') then return new;end if;
 if new.user_id is distinct from auth.uid() then raise exception 'Question owner mismatch';end if;
 if new.audience like '%skin' and new.skin_type is null then raise exception 'Add your skin type to invite a matching audience';end if;
 if (select count(*) from public.unmask_questions where user_id=new.user_id and created_at>now()-interval '1 day' and audience not in('none','everyone'))>3 then raise exception 'You have reached today’s three audience invitations. Choose Everyone without a filter, or try tomorrow.';end if;
 select * into p from public.unmask_catalog where id=new.product_id;
 insert into public.unmask_activity(user_id,kind,title,body,route)
 select people.user_id,'question','Can your experience help someone choose?',
 'Someone is considering '||p.name||' and asked '||case when new.audience='everyone_skin' then 'people with the same skin type' when new.audience in('same_product','same_product_skin') then 'people who have used this product' else 'people who have used this or a similar product' end||case when new.audience in('same_product_skin','similar_products_skin') then ' with the same skin type' else '' end||'. '||left(new.body,160)||' Your private records were not shared.','/question/'||new.id::text
 from (
   select j.user_id,j.product_id,j.skin_type from public.unmask_journeys j where j.status<>'purchased'
   union all select e.user_id,e.product_id,e.skin_type from public.clarity_experiences e where e.moderation_status='visible'
   union all select prefs.user_id,null::text,prefs.skin_type from public.clarity_preferences prefs where new.audience='everyone_skin'
 ) people
 left join public.unmask_catalog c on c.id=people.product_id
 left join public.clarity_preferences prefs on prefs.user_id=people.user_id
 where people.user_id<>new.user_id and coalesce(prefs.product_question_invites,true)
 and (new.audience='everyone_skin' or people.product_id=new.product_id or (new.audience in('similar_products','similar_products_skin') and lower(c.category)=lower(p.category) and nullif(trim(p.category),'') is not null and lower(c.brand)=lower(p.brand) and nullif(trim(p.brand),'') is not null))
 and (new.audience not like '%skin' or coalesce(nullif(people.skin_type,''),prefs.skin_type)=new.skin_type)
 and not exists(select 1 from public.unmask_activity a where a.user_id=people.user_id and a.kind='question' and a.title='Can your experience help someone choose?' and a.created_at>now()-interval '1 day')
 group by people.user_id order by people.user_id limit 40;
 return new;end$$;
revoke all on function unmask_private.invite_product_users() from public,anon,authenticated;
