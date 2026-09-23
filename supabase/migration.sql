-- ============================================================
--  BillDesk — Supabase schema (run in Supabase → SQL Editor)
--  Matches the architecture diagram:
--  Postgres (bills, categories, profiles, payments) + Auth + RLS
--  Bills = inward register: inward no, bill type, claim ₹,
--  head of account, CP no, e-office, doc upload, Drive link,
--  status workflow, assigned officer.
-- ============================================================

-- ---------- Tables ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  designation text not null default '',
  avatar_url  text,
  phone       text,
  role        text not null default 'user'
              check (role in ('user','sub_admin','master_admin')),
  theme       text not null default 'dark',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.categories (   -- bill types
  id    bigint generated always as identity primary key,
  name  text not null unique,
  icon  text,
  color text
);

create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  inward_no       text,
  bill_type       text not null default 'Other',
  bill_date       date not null default current_date,
  description     text,
  amount          numeric(12,2) not null default 0 check (amount >= 0),  -- claim ₹
  e_office        text,
  status          text not null default 'processing'
                  check (status in ('processing','submitted','approved','paid','rejected')),
  head_of_account text,
  cp_no           text,
  due_date        date,                       -- optional (reminders)
  drive_url       text,                       -- Google Drive bill copy
  doc_url         text,                       -- uploaded bill copy (storage)
  doc_name        text,
  notes           text,                       -- remarks
  assigned_to     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index bills_user_date_idx on public.bills (user_id, bill_date);
create index bills_date_idx      on public.bills (bill_date);
create index bills_status_idx    on public.bills (status);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.bills(id) on delete cascade,
  amount      numeric(12,2) not null,
  method      text default 'manual',
  recorded_by uuid references public.profiles(id),
  paid_at     timestamptz not null default now()
);

-- log of WhatsApp reminders sent by the Edge Function
create table public.notifications_log (
  id       uuid primary key default gen_random_uuid(),
  bill_id  uuid references public.bills(id) on delete set null,
  user_id  uuid references public.profiles(id) on delete set null,
  channel  text not null default 'whatsapp',
  phone    text,
  status   text,
  sent_at  timestamptz not null default now()
);

-- ---------- Helper functions (security definer avoids RLS recursion) ----------
create or replace function public.is_master_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role = 'master_admin' and is_active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role in ('sub_admin','master_admin') and is_active);
$$;

-- ---------- Triggers ----------
-- 1) auto-create a profile for every new auth user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, designation, phone)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'designation',''),
          coalesce(new.raw_user_meta_data->>'phone', null));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) keep updated_at fresh ("Modified" column)
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger bills_touch before update on public.bills
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 3) 👑 ROYAL GOLDEN THEME — Master Admin only (enforced in the DB itself)
create or replace function public.guard_theme() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.theme = 'golden' and new.role <> 'master_admin' then
    new.theme = 'dark';  -- silently fall back instead of erroring
  end if;
  return new;
end $$;
create trigger profiles_theme_guard
  before insert or update on public.profiles
  for each row execute function public.guard_theme();

-- 4) role changes: only Master Admin, never on yourself,
--    never remove the last Master Admin
create or replace function public.guard_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role then
    -- bootstrap: SQL editor / dashboard / service-role has no logged-in user
    if auth.uid() is null then
      return new;
    end if;
    if not is_master_admin() then
      raise exception 'Only the Master Admin can change roles';
    end if;
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;
    if old.role = 'master_admin' and new.role <> 'master_admin' then
      if (select count(*) from profiles where role = 'master_admin' and is_active) <= 1 then
        raise exception 'Cannot remove the last Master Admin';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_role();

-- ---------- RLS ----------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.bills             enable row level security;
alter table public.payments          enable row level security;
alter table public.notifications_log enable row level security;

-- profiles
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles: insert self" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid() or is_master_admin());
create policy "profiles: delete by master" on public.profiles
  for delete using (is_master_admin());

-- bill types: everyone reads, master admin writes
create policy "categories: read" on public.categories
  for select using (auth.uid() is not null);
create policy "categories: master writes" on public.categories
  for all using (is_master_admin()) with check (is_master_admin());

-- bills: users see & manage their own, PLUS bills assigned to them;
-- admins see & manage all
create policy "bills: read own/assigned or admin" on public.bills
  for select using (user_id = auth.uid() or assigned_to = auth.uid() or is_admin());
create policy "bills: insert own or admin" on public.bills
  for insert with check (user_id = auth.uid() or is_admin());
create policy "bills: update own or admin" on public.bills
  for update using (user_id = auth.uid() or is_admin());
create policy "bills: delete own or admin" on public.bills
  for delete using (user_id = auth.uid() or is_admin());

-- payments
create policy "payments: read own or admin" on public.payments
  for select using (recorded_by = auth.uid() or is_admin()
                     or exists (select 1 from bills b where b.id = bill_id and b.user_id = auth.uid()));
create policy "payments: insert own or admin" on public.payments
  for insert with check (recorded_by = auth.uid() or is_admin());

-- notifications log: only the edge function (service role) writes; admins read
create policy "notif: admin read" on public.notifications_log
  for select using (is_admin());

-- ---------- Storage buckets (avatars + bill copies) ----------
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('bill-copies','bill-copies', true)
  on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars: own write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: own delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "bill-copies: read" on storage.objects
  for select using (bucket_id = 'bill-copies');
create policy "bill-copies: own write" on storage.objects
  for insert with check (bucket_id = 'bill-copies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bill-copies: own update" on storage.objects
  for update using (bucket_id = 'bill-copies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bill-copies: own delete" on storage.objects
  for delete using (bucket_id = 'bill-copies' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Seed bill types ----------
insert into public.categories (name, icon, color) values
  ('TA Bill','🚌','#f59e0b'),
  ('TA Advance','💰','#22c55e'),
  ('Tour Bill','🧳','#0ea5e9'),
  ('Medical Bill','🏥','#ef4444'),
  ('Office Expense','🖇️','#8b5cf6'),
  ('Purchase Bill','🛒','#10b981'),
  ('Internet & Phone','🌐','#06b6d4'),
  ('Electricity','⚡','#f59e0b'),
  ('Water','💧','#38bdf8'),
  ('Rent','🏠','#e0417d'),
  ('Contingency','📦','#64748b'),
  ('Other','📄','#94a3b8')
on conflict (name) do nothing;

-- ============================================================
--  ⏰ Schedule the WhatsApp reminder Edge Function every hour
--  (requires pg_cron + pg_net: enable them in Database → Extensions)
--  Run AFTER deploying the function and replacing <PROJECT_REF>
--  and <ANON_KEY>.
-- ============================================================
-- select cron.schedule('billdesk-whatsapp-reminders', '0 * * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer <ANON_KEY>',
--       'Content-Type', 'application/json',
--       'x-cron-secret', '<YOUR_CRON_SECRET>'
--     ),
--     body := '{}'::jsonb
--   );
-- $$);
