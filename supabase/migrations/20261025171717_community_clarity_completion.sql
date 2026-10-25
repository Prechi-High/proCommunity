begin;
alter table public.unmask_investigations add column spark_goal integer not null default 500 check(spark_goal between 10 and 1000000);
-- Only editorial administrators may change an existing target; ordinary users cannot choose one on insert.
create function public.unmask_guard_spark_goal() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.spark_goal<>500 and not coalesce(public.cw_admin(),false) then raise exception 'Only the team can set an investigation target';end if;
 if tg_op='UPDATE' and new.spark_goal is distinct from old.spark_goal and not coalesce(public.cw_admin(),false) then raise exception 'Only the team can set an investigation target';end if;
 return new;
end;$$;
create trigger guard_spark_goal before insert or update on public.unmask_investigations for each row execute function public.unmask_guard_spark_goal();
revoke all on function public.unmask_guard_spark_goal() from public,anon,authenticated;

alter table public.unmask_answers add column attached_experience_id uuid references public.clarity_experiences(id) on delete set null;
alter table public.clarity_experience_replies add column attached_experience_id uuid references public.clarity_experiences(id) on delete set null;
create function public.unmask_guard_experience_attachment() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare target_product text;begin
 if new.attached_experience_id is null then return new;end if;
 if tg_table_name='unmask_answers' then select product_id into target_product from public.unmask_questions where id=new.question_id;
 else select product_id into target_product from public.clarity_experiences where id=new.experience_id;end if;
 if not exists(select 1 from public.clarity_experiences e where e.id=new.attached_experience_id and e.user_id=auth.uid() and e.visibility='public' and e.moderation_status='visible' and e.product_id=target_product) then raise exception 'Attach your own published experience for this product';end if;
 return new;
end;$$;
create trigger guard_answer_attachment before insert or update on public.unmask_answers for each row execute function public.unmask_guard_experience_attachment();
create trigger guard_reply_attachment before insert or update on public.clarity_experience_replies for each row execute function public.unmask_guard_experience_attachment();
revoke all on function public.unmask_guard_experience_attachment() from public,anon,authenticated;

-- Keep the existing transactional wallet debit and idempotency, but refuse new support once assigned/published.
create or replace function public.contribute_investigation(p_id uuid,p_kind text,p_amount integer,p_public boolean,p_key uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); w public.unmask_spark_wallets; c public.unmask_spark_contributions; current_status text;
begin
 if u is null then raise exception 'Sign in to support an investigation'; end if;
 if p_key is null or p_public is null or p_kind is null or p_kind not in('sparks','thunder') or p_amount is null or p_amount>1000000 or p_amount<(case when p_kind='sparks' then 10 else 1 end) then raise exception 'Choose a valid contribution amount';end if;
 select status into current_status from public.unmask_investigations where id=p_id for update;
 if not found then raise exception 'Investigation unavailable';end if;
 insert into public.unmask_spark_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.unmask_spark_wallets where user_id=u for update;
 select * into c from public.unmask_spark_contributions where user_id=u and request_key=p_key;
 if found then
 if c.investigation_id<>p_id or c.kind<>p_kind or c.amount<>p_amount or c.public_ack<>p_public then raise exception 'Contribution reference already used';end if;
 else
 if current_status<>'requested' then raise exception 'Support is closed for this investigation';end if;
 if (p_kind='sparks' and w.sparks<p_amount) or (p_kind='thunder' and w.thunder<p_amount) then raise exception 'Insufficient wallet balance';end if;
 update public.unmask_spark_wallets set sparks=sparks-case when p_kind='sparks' then p_amount else 0 end,thunder=thunder-case when p_kind='thunder' then p_amount else 0 end where user_id=u;
 insert into public.unmask_spark_contributions(user_id,investigation_id,kind,amount,public_ack,request_key) values(u,p_id,p_kind,p_amount,p_public,p_key) returning * into c;
 end if;
 select * into w from public.unmask_spark_wallets where user_id=u;
 return jsonb_build_object('id',c.id,'kind',c.kind,'amount',c.amount,'public_ack',c.public_ack,'sparks',w.sparks,'thunder',w.thunder,'summary',public.investigation_support_summary(p_id));
end; $$;
revoke all on function public.contribute_investigation(uuid,text,integer,boolean,uuid) from public,anon;
grant execute on function public.contribute_investigation(uuid,text,integer,boolean,uuid) to authenticated;
commit;
