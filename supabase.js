import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { enabled: false }
  }
);
/**
 * Run this SQL once in Supabase → SQL Editor to set up the schema:
 *
 * ── Enable pgcrypto for encryption ──────────────────────────────────────────
 * create extension if not exists pgcrypto;
 *
 * ── Profiles (shipping info) ─────────────────────────────────────────────────
 * create table public.profiles (
 *   id          uuid primary key references auth.users(id) on delete cascade,
 *   first_name  text,
 *   last_name   text,
 *   email       text,
 *   phone       text,
 *   address     text,
 *   city        text,
 *   state       text,
 *   zip         text,
 *   country     text default 'US',
 *   created_at  timestamptz default now()
 * );
 * alter table public.profiles enable row level security;
 * create policy "Users can manage own profile"
 *   on public.profiles for all using (auth.uid() = id);
 *
 * ── Payment cards (encrypted with pgcrypto) ──────────────────────────────────
 * create table public.payment_cards (
 *   id           uuid primary key default gen_random_uuid(),
 *   user_id      uuid references auth.users(id) on delete cascade,
 *   card_label   text,                    -- e.g. "Visa ending 4242"
 *   card_enc     bytea not null,          -- pgp_sym_encrypt(card_json, secret)
 *   is_default   boolean default false,
 *   created_at   timestamptz default now()
 * );
 * alter table public.payment_cards enable row level security;
 * create policy "Users can manage own cards"
 *   on public.payment_cards for all using (auth.uid() = user_id);
 *
 * ── Orders ───────────────────────────────────────────────────────────────────
 * create table public.orders (
 *   id           uuid primary key default gen_random_uuid(),
 *   user_id      uuid references auth.users(id) on delete cascade,
 *   product_title text,
 *   product_store text,
 *   product_url   text,
 *   price         numeric,
 *   order_ref     text,                   -- store's order number
 *   status        text default 'placed',  -- placed | shipped | delivered | failed
 *   placed_at     timestamptz default now()
 * );
 * alter table public.orders enable row level security;
 * create policy "Users can view own orders"
 *   on public.orders for all using (auth.uid() = user_id);
 */
