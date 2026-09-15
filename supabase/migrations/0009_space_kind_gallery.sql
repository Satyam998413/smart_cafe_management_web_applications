-- Adds 'gallery' as a valid spaces.kind value (top-level, alongside floor/
-- hall — see src/lib/spaceTree.js's TOP_LEVEL_KINDS).
--
-- The `spaces` table was created outside this repo's tracked migrations
-- (like `users`/`bookings`.customer_id before it), so the real name of its
-- kind check constraint isn't knowable from the code alone — guessing it
-- (e.g. assuming the Postgres-default `spaces_kind_check`) and blindly
-- dropping that name would silently no-op if the guess is wrong, leaving
-- the OLD constraint still in force and 'gallery' inserts still rejected
-- with a confusing error. This instead looks up the actual constraint by
-- inspecting pg_constraint for a check constraint on spaces whose
-- definition mentions "kind", drops it by its real name, then adds a
-- freshly, predictably named one.
do $$
declare
  found_constraint text;
begin
  select con.conname into found_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'spaces'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%kind%';

  if found_constraint is not null then
    execute format('alter table public.spaces drop constraint %I', found_constraint);
  end if;
end $$;

alter table public.spaces
  add constraint spaces_kind_check check (kind in ('floor', 'hall', 'table', 'room', 'canteen', 'gallery'));
