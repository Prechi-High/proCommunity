-- Unique barcode for Open Beauty Facts / catalog upserts (app id = barcode).
-- Service-role writes only; anon remains read-only via existing RLS.

create unique index if not exists products_barcode_unique
  on public.products (barcode)
  where barcode is not null and barcode <> '';
