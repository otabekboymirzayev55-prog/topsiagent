-- Apply in Supabase SQL Editor before deploying the chat and image endpoints.
create extension if not exists pgcrypto;
create table if not exists public.chats (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists chats_user_updated_idx on public.chats (user_id, updated_at desc);
alter table public.chats enable row level security;

drop policy if exists "Users can read own chats" on public.chats;
create policy "Users can read own chats" on public.chats
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own chats" on public.chats;
create policy "Users can create own chats" on public.chats
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own chats" on public.chats;
create policy "Users can update own chats" on public.chats
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own chats" on public.chats;
create policy "Users can delete own chats" on public.chats
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.chat_images (
  id uuid primary key,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  created_at timestamptz not null default now()
);
create index if not exists chat_images_chat_idx on public.chat_images (chat_id);
alter table public.chat_images enable row level security;

create table if not exists public.chat_shares (
  id uuid primary key,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chat_shares_chat_idx on public.chat_shares (chat_id, created_at desc);
alter table public.chat_shares enable row level security;

-- Storage deletions cannot join the chat row deletion transaction. This private
-- queue retains file paths until the server has removed the objects.
create table if not exists public.chat_image_cleanup (
  id uuid primary key,
  chat_id uuid not null,
  object_paths text[] not null,
  created_at timestamptz not null default now()
);
alter table public.chat_image_cleanup enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
