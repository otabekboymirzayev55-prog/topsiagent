-- Run once in Supabase SQL Editor before enabling saved products.
create extension if not exists pgcrypto;

create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  store text not null,
  url text not null check (length(url) <= 2048),
  last_price numeric,
  baseline_price numeric,
  currency text,
  tracking_enabled boolean not null default false,
  status text not null default 'not_checked' check (status in ('not_checked', 'active', 'paused', 'price_unavailable')),
  last_error text,
  last_checked_at timestamptz,
  checking_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url),
  check (last_price is null or last_price > 0),
  check (baseline_price is null or baseline_price > 0),
  check (currency is null or currency ~ '^[A-Z]{3}$')
);
create index if not exists saved_products_user_created_idx on public.saved_products (user_id, created_at desc);
create index if not exists saved_products_due_idx on public.saved_products (last_checked_at) where tracking_enabled;
alter table public.saved_products enable row level security;
revoke all on public.saved_products from anon, authenticated;
grant select on public.saved_products to authenticated;
grant all on public.saved_products to service_role;
drop policy if exists "Users read own saved products" on public.saved_products;
create policy "Users read own saved products" on public.saved_products for select to authenticated using (auth.uid() = user_id);

create table if not exists public.price_notifications (
  id uuid primary key default gen_random_uuid(),
  saved_product_id uuid not null references public.saved_products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  previous_price numeric not null check (previous_price > 0),
  price numeric not null check (price > 0 and price < previous_price),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists price_notifications_user_created_idx on public.price_notifications (user_id, created_at desc);
alter table public.price_notifications enable row level security;
revoke all on public.price_notifications from anon, authenticated;
grant select on public.price_notifications to authenticated;
grant all on public.price_notifications to service_role;
drop policy if exists "Users read own price notifications" on public.price_notifications;
create policy "Users read own price notifications" on public.price_notifications for select to authenticated using (auth.uid() = user_id);

-- Only the backend service role may apply verified prices. The owner and
-- check lease are checked again inside the atomic price/notification update.
create or replace function public.apply_saved_product_price(
  p_user_id uuid, p_id uuid, p_lease timestamptz, p_price numeric,
  p_currency text, p_checked_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  product public.saved_products%rowtype;
  dropped boolean;
begin
  if p_price is null or p_currency is null or p_checked_at is null or p_lease is null
    or p_price <= 0 or p_price >= 1000000000000 or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid verified price';
  end if;
  select * into product from public.saved_products
    where id = p_id and user_id = p_user_id and checking_until = p_lease for update;
  if not found then return null; end if;
  dropped := product.tracking_enabled and product.currency = p_currency
    and product.last_price is not null and p_price < product.last_price;
  if dropped then
    insert into public.price_notifications (saved_product_id, user_id, title, url, previous_price, price, currency, created_at)
      values (product.id, product.user_id, product.title, product.url, product.last_price, p_price, p_currency, p_checked_at);
  end if;
  update public.saved_products set
    baseline_price = case when currency = p_currency and baseline_price is not null then baseline_price else p_price end,
    last_price = p_price, currency = p_currency, checking_until = null,
    last_checked_at = p_checked_at, last_error = null,
    status = case when tracking_enabled then 'active' else 'paused' end,
    updated_at = now()
    where id = product.id returning * into product;
  return jsonb_build_object('row', to_jsonb(product), 'price_drop', coalesce(dropped, false));
end;
$$;
revoke all on function public.apply_saved_product_price(uuid, uuid, timestamptz, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_saved_product_price(uuid, uuid, timestamptz, numeric, text, timestamptz) to service_role;
