-- Migration 0020: biometric enrollment/verification, per-user lock access
-- grants, and the access/attendance audit trail.
--
-- Fingerprint matching happens ON THE SENSOR CHIP itself (confirmed
-- hardware capability, see src/lib/mqttServer.js's biometrics handlers and
-- src/app/api/biometrics/verify/route.js's own comment) — the device scans
-- a finger, searches its own local template gallery, and reports back which
-- of ITS OWN template slots matched (sensor_template_id) plus a confidence
-- score. The server never processes fingerprint images for matching; it
-- only stores the >=3 captured images for the manager assignment screen's
-- audit trail, and maps (device_id, sensor_template_id) -> a user once a
-- manager assigns it. This is also why sensor_template_id is only unique
-- PER DEVICE, never globally: it's a slot number on one physical chip, not
-- a portable identifier — the same finger enrolled on two different
-- physical sensors gets two unrelated slot numbers, so a user who should
-- unlock two different doors must be enrolled at each door's sensor
-- separately (the same real-world constraint every standalone fingerprint
-- door lock has).
--
-- Face recognition is the opposite: the image genuinely is the credential.
-- The server extracts an embedding at enrollment (src/lib/biometrics/
-- face.js) and, at verification, extracts the presented photo's embedding
-- and searches it against every ready, assigned face embedding in the org
-- (identification, not a claimed-identity 1:1 check) — fast enough at
-- cafe-fleet staff-roster scale that no claimed identity is needed before
-- matching, which is also closer to how the hardware is actually used
-- (look at the camera, nothing else).
create table if not exists public.biometric_captures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Not a foreign key: a capture can come from either punching_devices or
  -- smart_locks (biometric_lock), and Postgres has no polymorphic FK — the
  -- same tradeoff src/lib/deviceAuth.js's category+id pairing already makes
  -- elsewhere in this codebase.
  device_id uuid not null,
  device_category varchar(20) not null check (device_category in ('lock', 'punching')),
  modality varchar(10) not null check (modality in ('fingerprint', 'face')),
  finger_position varchar(20),
  image_paths jsonb not null default '[]',
  -- Fingerprint: the device's own on-chip template slot number for this
  -- capture (see header comment) — an opaque device-local identifier, not
  -- a portable template blob. Face: the extracted embedding, a small
  -- fixed-length numeric vector, stored as jsonb (a JSON float array) to
  -- match this codebase's existing convention for structured data
  -- (settings/capabilities/items/specifications are all jsonb elsewhere).
  sensor_template_id varchar(50),
  face_embedding jsonb,
  -- Fingerprint rows go straight to 'ready' (the sensor already did the
  -- only "extraction" there is). Face rows start 'pending' while
  -- src/lib/biometrics/face.js's embedding extraction runs, asynchronously,
  -- after the row + images are already persisted.
  status varchar(20) not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  extraction_error text,
  assigned_to_user_id uuid references public.users (id) on delete set null,
  assigned_by uuid references public.users (id),
  assigned_at timestamptz,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (modality = 'fingerprint' and finger_position is not null and sensor_template_id is not null) or
    (modality = 'face')
  )
);

-- A given device's sensor slot can only ever mean one enrollment at a time.
create unique index if not exists idx_biometric_captures_device_slot
  on public.biometric_captures (device_id, sensor_template_id)
  where modality = 'fingerprint';

-- "Unassigned, newest first" manager screen.
create index if not exists idx_biometric_captures_unassigned
  on public.biometric_captures (org_id, captured_at desc)
  where assigned_to_user_id is null;

-- Fingerprint verification hot path: given the device that scanned and the
-- slot number it reported, find the owning user directly — an indexed
-- point lookup, no computation at all.
create index if not exists idx_biometric_captures_device_slot_lookup
  on public.biometric_captures (device_id, sensor_template_id)
  where modality = 'fingerprint' and assigned_to_user_id is not null;

-- Face verification hot path: the full candidate gallery for one org's
-- identification search.
create index if not exists idx_biometric_captures_org_face_ready
  on public.biometric_captures (org_id)
  where modality = 'face' and status = 'ready' and assigned_to_user_id is not null;

create index if not exists idx_biometric_captures_org on public.biometric_captures (org_id, created_at desc);

-- access_grants: per-user-per-lock. Presence = granted; revoke = delete row
-- (no soft-revoke/status column — a grant genuinely stops existing, unlike
-- rfid_cards' blocked/lost states which preserve a physical card's history).
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  lock_id uuid not null references public.smart_locks (id) on delete cascade,
  granted_by uuid references public.users (id),
  granted_at timestamptz not null default now(),
  unique (user_id, lock_id)
);
create index if not exists idx_access_grants_lock on public.access_grants (lock_id);
create index if not exists idx_access_grants_org on public.access_grants (org_id);

-- access_events: the audit trail — every verification attempt, matched or
-- not. user_id nullable + on delete set null specifically so a future user
-- deletion never silently wipes access history (unlike most FKs here, an
-- audit log should survive that).
create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  device_id uuid not null,
  device_category varchar(20) not null check (device_category in ('lock', 'punching')),
  modality varchar(10) not null check (modality in ('fingerprint', 'face', 'rfid')),
  matched boolean not null,
  confidence numeric(5, 4),
  access_result varchar(10) check (access_result in ('granted', 'denied')),
  image_path text,
  attendance_log_id uuid references public.attendance_logs (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (device_category = 'lock' and access_result is not null) or
    (device_category = 'punching' and access_result is null)
  )
);

create index if not exists idx_access_events_user on public.access_events (user_id, created_at desc);
create index if not exists idx_access_events_device on public.access_events (device_id, created_at desc);
create index if not exists idx_access_events_org on public.access_events (org_id, created_at desc);

-- No RLS: same stance as every other table added since 0002 — service-role
-- client with app-level org_id scoping, not per-request Postgres RLS.
