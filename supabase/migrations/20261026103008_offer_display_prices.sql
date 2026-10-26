alter table public.unmask_offers
 add column price numeric(12,2) check(price>=0),
 add column compare_at_price numeric(12,2) check(compare_at_price>=0),
 add column currency text not null default 'NGN' check(currency ~ '^[A-Z]{3}$');
