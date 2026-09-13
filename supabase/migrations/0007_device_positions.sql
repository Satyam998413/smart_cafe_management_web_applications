-- Adds the floor-plan canvas position columns to `devices`. Split out as its
-- own migration rather than folded back into 0006: 0006 was already applied
-- (confirmed live — devices/device_states/device_commands/device_counters
-- all exist) before pos_x/pos_y were added to that file for Phase 4, and
-- `create table if not exists` is a no-op on a table that already exists —
-- it does not retroactively add columns. 0006 stays as the correct full
-- shape for a fresh install; this is the delta for an environment that
-- already ran the earlier version of it.
alter table public.devices add column if not exists pos_x numeric(5, 2);
alter table public.devices add column if not exists pos_y numeric(5, 2);
