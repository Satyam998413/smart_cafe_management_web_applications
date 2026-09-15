-- Platform-level AI provider default, configurable by Master Admin via
-- /admin/ai-configuration (src/app/api/admin/ai-configuration/**). Same
-- shape as org_ai_credentials minus org_id — deliberately a separate table
-- rather than making org_ai_credentials.org_id nullable, since that column
-- is NOT NULL today and every existing row/insert sets it.
--
-- Sits between an org's own credentials and the raw-env-var global
-- providers in the fallback chain (src/lib/aiClient.js's
-- sendChatCompletion): org credentials -> this table -> env vars. Multiple
-- rows are allowed (mirrors org_ai_credentials, e.g. for rotating a key
-- without losing the old row's audit trail) but only is_active=true rows
-- are ever read.
create table if not exists public.platform_ai_credentials (
  id uuid primary key default gen_random_uuid(),
  provider varchar(50) not null,
  api_key_encrypted text not null,
  base_url text,
  model varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_ai_credentials_active on public.platform_ai_credentials (is_active);

-- RLS intentionally not enabled — same stance as every other table added
-- this session: service-role client with app-level requireMasterAdmin
-- gating, not per-request Postgres RLS, until that migration happens
-- project-wide.
