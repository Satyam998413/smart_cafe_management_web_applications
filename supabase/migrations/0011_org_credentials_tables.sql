-- Two pre-existing tables that turned out to have never actually been
-- created in this database either — same situation as devices/bookings/
-- platform_offers before them: the code (src/lib/aiProviders.js,
-- src/app/api/admin/organizations/[id]/ai-credentials/**,
-- .../data-plane/route.js) was written against these tables, but confirmed
-- live (full PostgREST schema diffed against every `.from('...')` call in
-- src/) that they were never created. Found by auditing every table name
-- referenced anywhere in the codebase against the live schema in one pass,
-- rather than fixing them one 500 error at a time.

-- Per-tenant AI provider credentials (plan Phase 7) — same shape as
-- platform_ai_credentials (0010), plus org scoping. Tried before the
-- platform default and the raw-env-var providers in
-- src/lib/aiClient.js's sendChatCompletion.
create table if not exists public.org_ai_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider varchar(50) not null,
  api_key_encrypted text not null,
  base_url text,
  model varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_org_ai_credentials_org_id on public.org_ai_credentials (org_id, is_active);

-- One BYO-Supabase data-plane credential per org (plan Phase 8) — org_id is
-- the primary key since a tenant has at most one, matching the
-- `onConflict: 'org_id'` upsert in the data-plane route.
create table if not exists public.org_data_plane_credentials (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  supabase_url text not null,
  anon_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS intentionally not enabled — same stance as every other table added
-- this session: service-role client with app-level requireMasterAdmin
-- gating, not per-request Postgres RLS, until that migration happens
-- project-wide.
