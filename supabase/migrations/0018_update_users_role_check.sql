-- Migration 0018: Update users_role_check constraint to include 'technician' and 'salesman' roles
-- Idempotent check constraint replacement.

do $$
declare
  found_constraint text;
begin
  select con.conname into found_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'users'
    and con.contype = 'c'
    and con.conname like '%role%';

  if found_constraint is not null then
    execute format('alter table public.users drop constraint %I', found_constraint);
  end if;
end $$;

alter table public.users
  add constraint users_role_check check (role in ('master_admin', 'salesman', 'technician', 'owner', 'manager', 'cook', 'waiter', 'customer'));
