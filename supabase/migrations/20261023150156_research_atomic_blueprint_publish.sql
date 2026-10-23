-- Internal, lease-guarded publication batch; no arbitrary client SQL or table access.
create or replace function public.research_blueprint_batch(p_task uuid,p_lease uuid,p_ops jsonb)
returns boolean language plpgsql set search_path='' as $$
declare t public.research_tasks; r public.research_runs; op jsonb; tbl text; cols text; updates text; filter_col text; filter_value text; filter_text text; rowdata jsonb;
begin
 select * into t from public.research_tasks where id=p_task and lease=p_lease and state='running' and kind='coordinate' for update;
 if not found then return false;end if;
 select * into r from public.research_runs where id=t.run_id;
 if jsonb_array_length(p_ops)>100 then raise exception 'too many publication operations';end if;
 for op in select value from jsonb_array_elements(p_ops) loop
  tbl:=op->>'table';
  if tbl not in ('product_blueprints','blueprint_sections','product_fact_sections','product_fact_fields','evaluation_dimensions','dimension_assessments','dimension_evidence','evidence','product_intel') then raise exception 'publication table disallowed';end if;
  if op->>'kind' in ('remove','patch') then
   filter_text:=op->>'filter';filter_col:=split_part(filter_text,'=eq.',1);filter_value:=split_part(filter_text,'=eq.',2);
   if filter_col not in ('id','blueprint_id','dimension_id') or filter_value='' then raise exception 'invalid publication filter';end if;
   if tbl='product_intel' then
    if op->>'kind'<>'patch' or filter_col<>'id' or filter_value<>r.product_id then raise exception 'invalid product publication';end if;
   elsif filter_value<>r.blueprint->>'blueprintId' and filter_value not like (r.blueprint->>'blueprintId')||'_dim_%' then raise exception 'publication filter outside blueprint';end if;
   if op->>'kind'='remove' then execute format('delete from public.%I where %I::text=$1',tbl,filter_col) using filter_value;
   else
    rowdata:=op->'row';
    select string_agg(format('%1$I=x.%1$I',key),',') into updates from jsonb_object_keys(rowdata)key;
    execute format('update public.%1$I q set %2$s from jsonb_populate_record(null::public.%1$I,$1) x where q.%3$I::text=$2',tbl,updates,filter_col) using rowdata,filter_value;
   end if;
  elsif op->>'kind' in ('insert','upsert') then
   rowdata:=op->'rows';if jsonb_array_length(rowdata)=0 then continue;end if;
   select string_agg(format('%I',key),',' order by key),string_agg(format('%1$I=excluded.%1$I',key),',' order by key) filter(where key<>'id') into cols,updates from jsonb_object_keys(rowdata->0)key;
   if op->>'kind'='upsert' then
    execute format('insert into public.%1$I(%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I,$1) on conflict(id) do update set %3$s',tbl,cols,updates) using rowdata;
   else execute format('insert into public.%1$I(%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I,$1) on conflict do nothing',tbl,cols) using rowdata;end if;
  else raise exception 'publication operation disallowed';end if;
 end loop;
 return true;
end $$;
revoke all on function public.research_blueprint_batch(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.research_blueprint_batch(uuid,uuid,jsonb) to service_role;
