-- ============================================================
-- FIX: "Only the Master Admin can change roles" during bootstrap
-- Run this ONCE in Supabase SQL Editor (it replaces the guard).
-- It lets dashboard/SQL-editor sessions (no one logged in, i.e.
-- auth.uid() is null) set roles — needed to create the FIRST
-- Master Admin. App users are always logged in, so the guard
-- still fully protects them.
-- ============================================================

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

-- Now this will work (edit the email to match your admin):
-- update public.profiles
-- set role = 'master_admin', theme = 'golden'
-- where email = 'ramesh@office.local';
