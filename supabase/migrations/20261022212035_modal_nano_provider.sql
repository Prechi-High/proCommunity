-- Application budgets for one Modal GPU, not upstream API entitlements.
alter table public.research_provider_limits drop constraint research_provider_limits_provider_check;
alter table public.research_provider_limits add constraint research_provider_limits_provider_check check(provider in ('nvidia','groq','cloudflare','siliconflow','modal'));
insert into public.research_provider_limits(provider,rpm,tpm,concurrency) values('modal',6000,1000000,24) on conflict(provider) do nothing;

