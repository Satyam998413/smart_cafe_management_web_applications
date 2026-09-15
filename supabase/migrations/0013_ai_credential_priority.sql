-- Persisted priority ordering for multi-model AI credentials — lower value
-- tried first. A credential that fails a real request gets demoted (moved
-- to the back of its own scope's queue) by updating this column directly
-- (src/lib/aiProviders.js's demotePersistedCredential), so the reordering
-- survives across requests/restarts, unlike the in-memory-only demotion
-- the raw-env-var global providers already used.
alter table public.org_ai_credentials add column if not exists priority integer not null default 0;
alter table public.platform_ai_credentials add column if not exists priority integer not null default 0;

-- Which owner-role user this org credential belongs to — display/audit
-- only, no behavior change (org_ai_credentials is still scoped and shared
-- by org_id, used by every role in that org exactly as before). Resolved
-- server-side to the org's actual owner user at creation time, not the
-- Master Admin who happened to click save via /admin/organizations/[id]/ai
-- — configuration still goes through that admin console, this just records
-- whose credential it conceptually is. Nullable: an org could in principle
-- have no owner row yet.
alter table public.org_ai_credentials add column if not exists owner_id uuid references public.users (id);
