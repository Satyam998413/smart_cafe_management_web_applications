-- Creates the notifications table designed in
-- plan/multi-tenant-platform-master-plan.md Phase 1B (role-/user-targeted,
-- org-scoped alerts — the initial use case is low/zero coin-balance
-- warnings, wired up in src/lib/walletService.js's
-- checkBalanceThresholdNotification) but never actually built until now.
-- 0001_enable_row_level_security.sql and 0002_disable_row_level_security.sql
-- already reference 'notifications' in their table arrays, guarded with
-- to_regclass precisely because this table didn't exist yet — this file is
-- what finally makes those guards resolve to something real.
--
-- Deliberately does NOT enable row level security. See
-- 0002_disable_row_level_security.sql's own comment for why RLS is rolled
-- back project-wide right now (SUPABASE_JWT_SECRET mismatch + Route
-- Handlers not migrated to getScopedSupabase). This table is scoped purely
-- at the app layer (`.eq('org_id', ...)` in the Route Handlers), same as
-- every other table today — re-enabling RLS anywhere is explicitly out of
-- scope here.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- A row targets either a whole role (e.g. every manager at this org gets
  -- nudged) or one specific user, not both — nothing at the DB level
  -- enforces "exactly one set", since a row with neither would just match
  -- no one's GET rather than violate an integrity rule, so this is
  -- documented rather than constrained.
  target_role text,
  target_user_id uuid references public.users(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- GET /api/notifications filters by org_id + is_read + (target_role or
-- target_user_id) on every call, most recent first — index what that
-- query actually filters/sorts on.
create index if not exists notifications_org_unread_idx
  on public.notifications (org_id, is_read, created_at desc);
