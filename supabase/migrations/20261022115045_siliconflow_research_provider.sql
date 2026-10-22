-- SiliconFlow is separately governed; these initial app budgets are not account entitlements.
alter table public.research_provider_limits drop constraint research_provider_limits_provider_check;
alter table public.research_provider_limits add constraint research_provider_limits_provider_check
 check(provider in ('nvidia','groq','cloudflare','siliconflow'));
insert into public.research_provider_limits(provider,rpm,tpm,concurrency)
 values('siliconflow',1000,40000,4) on conflict(provider) do nothing;
