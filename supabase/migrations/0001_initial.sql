create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'America/Santo_Domingo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  category text not null default 'other' check (category in ('work','personal','family','finance','home','shopping','appointments','projects','health','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  recurrence text,
  source text not null default 'manual' check (source in ('manual','voice_web','whatsapp','ai')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks(user_id, due_at);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null unique,
  created_at timestamptz not null default now(),
  last_inbound_at timestamptz
);

create index if not exists whatsapp_contacts_user_idx on public.whatsapp_contacts(user_id);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  phone_number text not null,
  message_type text not null,
  body text,
  raw_payload jsonb,
  received_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_phone_idx on public.whatsapp_messages(phone_number, received_at desc);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "tasks_select_own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "whatsapp_contacts_select_own" on public.whatsapp_contacts for select to authenticated using ((select auth.uid()) = user_id);
create policy "whatsapp_contacts_insert_own" on public.whatsapp_contacts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "whatsapp_contacts_update_own" on public.whatsapp_contacts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "whatsapp_contacts_delete_own" on public.whatsapp_contacts for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

-- Updated-at helper for profiles.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure private.set_updated_at();

-- Least-privilege Data API grants for the exposed tables.
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.whatsapp_contacts to authenticated;
grant all on public.tasks to service_role;
grant all on public.profiles to service_role;
grant all on public.whatsapp_contacts to service_role;
grant all on public.whatsapp_messages to service_role;
