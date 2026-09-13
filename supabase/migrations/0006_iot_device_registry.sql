-- IoT device registry: devices / device_states / device_commands.
-- These tables never actually existed in this database — confirmed by
-- pulling the live PostgREST OpenAPI schema and finding only the unrelated
-- `device_tokens` (FCM push-token) table. src/app/api/iot-devices/** and
-- src/features/iot/IotDevicesPage.jsx already have working code written
-- against exactly this shape; it's just never had a table to talk to.
-- Guarded with if not exists throughout, safe to re-run.

-- ---------------------------------------------------------------------------
-- Per-org sequential device numbering (the "unique, auto-incrementing, NOT a
-- UUID" device id the org sees, e.g. formatted as DEV-0007 in the API layer
-- — see serializeDevice). A separate counter table rather than a Postgres
-- SEQUENCE, since a SEQUENCE is one global object and this needs one
-- independently-incrementing counter per org.
-- ---------------------------------------------------------------------------
create table if not exists public.device_counters (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  next_value integer not null default 1
);

-- Atomically reserves p_count consecutive numbers for an org and returns the
-- first one. INSERT ... ON CONFLICT DO UPDATE ... RETURNING is one
-- statement, so Postgres's own row lock makes concurrent registrations for
-- the same org safe without an explicit transaction or advisory lock.
create or replace function public.next_device_no(p_org_id uuid, p_count integer default 1)
returns integer
language plpgsql
as $$
declare
  v_start integer;
begin
  insert into public.device_counters (org_id, next_value)
  values (p_org_id, p_count + 1)
  on conflict (org_id) do update set next_value = device_counters.next_value + p_count
  returning next_value - p_count into v_start;
  return v_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- Devices. type is a real enum now (lamp/fan/ac/other) rather than free
-- text, matching the equipment taxonomy the dashboard's registration form
-- offers. One row per physical device instance — registering "5 lamps"
-- creates 5 rows, not a quantity column on one row (see iot-devices POST).
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  device_no integer not null,
  name varchar(255) not null,
  type varchar(20) not null check (type in ('lamp', 'fan', 'ac', 'other')),
  vendor varchar(50) not null default 'mock',
  external_device_id varchar(255),
  capabilities jsonb not null default '[]',
  -- Floor-plan canvas position, percentage (0-100) across/down the space's
  -- canvas — resolution-independent, unlike pixel coordinates. Null until
  -- the device is first dragged onto the canvas (it starts in an
  -- "unplaced" tray in the UI).
  pos_x numeric(5, 2),
  pos_y numeric(5, 2),
  created_at timestamptz not null default now(),
  unique (org_id, device_no)
);
create index if not exists idx_devices_org_id on public.devices (org_id);
create index if not exists idx_devices_space_id on public.devices (space_id);

-- Last known state per device, keyed by capability name (e.g.
-- {"on_off": true}) — updated only after a command is confirmed acked by
-- the vendor adapter, never optimistically.
create table if not exists public.device_states (
  device_id uuid primary key references public.devices (id) on delete cascade,
  state jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- The audit trail: one row per command attempt, inserted before the adapter
-- call so a command is recorded even if the adapter throws.
create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  capability varchar(50) not null,
  value jsonb not null,
  issued_by uuid references public.users (id),
  status varchar(20) not null default 'pending' check (status in ('pending', 'sent', 'acked', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_device_commands_device_id on public.device_commands (device_id, created_at desc);

-- RLS intentionally not enabled — same stance as 0002/0005: these routes
-- use the service-role client with app-level org_id scoping (scopeToOrg),
-- not per-request Postgres RLS, until that migration happens project-wide.
