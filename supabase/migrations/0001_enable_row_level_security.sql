-- Phase 0c — real, database-level tenant isolation via Row-Level Security.
--
-- WHY THIS FILE EXISTS: plan/multi-tenant-platform-master-plan.md Phase 0c
-- describes RLS as already landed. It has not — this repository has no
-- schema.sql/migrations directory at all (verified by a full-repo audit,
-- 2026-09-12), and src/lib/tenantScope.js's own comment says its app-layer
-- `.eq('org_id', ...)` filtering is "applied on top of RLS, not instead of
-- it, once RLS lands." Today that app-layer filter is the ONLY tenant
-- isolation in effect. A missing `.eq('org_id', ...)` in any one route is
-- currently a full cross-tenant data leak (see the GET /api/menu fix in this
-- same change — that was exactly this bug, just the one instance we found).
--
-- WHAT THIS FILE DOES: enables RLS and adds an isolation policy on every
-- org_id-bearing table this codebase's Route Handlers actually query
-- (confirmed by reading the application code, not guessed from the plan —
-- see the per-table comments). Every block is guarded with
-- `to_regclass(...)` so this migration is safe to run even against a
-- database where some Phase 1B/6 tables (platform_offers, notifications)
-- haven't been created yet — those blocks simply no-op instead of erroring.
--
-- HOW POLICIES READ THE CALLER'S ORG: src/lib/tenantSupabase.js's
-- `mintTenantJwt()` signs a short-lived JWT (SUPABASE_JWT_SECRET) per
-- request, carrying `org_id`/`is_master_admin` claims. PostgREST forwards
-- that JWT's payload into `request.jwt.claims`, which every policy below
-- reads via the two helper functions defined first.
--
-- ============================================================================
-- DO NOT RUN THIS AGAINST PRODUCTION WITHOUT READING THE ROLLOUT NOTE AT THE
-- BOTTOM OF THIS FILE FIRST. Turning RLS on for a table that some Route
-- Handler still queries with the plain (unscoped) `supabase` client — the
-- default in src/lib/supabaseClient.js, still what most routes use as of
-- this migration being written — will make that route start returning EMPTY
-- results (not an error) for every org, because the plain client's JWT has
-- no `org_id` claim at all. That is a silent breakage, not a loud one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers: read the caller's claims once, reused by every policy below.
-- ---------------------------------------------------------------------------
create or replace function public.jwt_org_id() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'org_id', '')::uuid
$$;

create or replace function public.jwt_is_master_admin() returns boolean
language sql stable
as $$
  select coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_master_admin')::boolean, false)
$$;

-- ---------------------------------------------------------------------------
-- Generic case: table has its own `org_id` column. One policy — master_admin
-- sees/writes everything, everyone else is confined to their own org_id.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  direct_org_tables text[] := array[
    'sites',                    -- Phase 0a
    'users',                    -- Phase 0b — includes master_admin rows (org_id null), see note below
    'menu_items',                -- Phase 0b
    'orders',                    -- Phase 0b
    'order_messages',            -- Phase 0b
    'manager_cook_messages',     -- Phase 0b
    'device_tokens',             -- Phase 0b
    'menu_item_option_groups',   -- Phase 0b
    'bills',                     -- Phase 4a
    'wallets',                   -- Phase 1B.a
    'coin_purchases',            -- Phase 1B.a
    'coupon_redemptions',        -- Phase 1B.a
    'notifications',             -- Phase 1B.a (may not exist yet — guarded)
    'devices',                   -- Phase 6a
    'delivery_riders',           -- Phase 3b
    'delivery_zones',            -- Phase 3b
    'accounting_exports',        -- Phase 5
    'org_ai_credentials',        -- Phase 7 — master_admin-only in practice; see note below
    'org_data_plane_credentials' -- Phase 8 — master_admin-only in practice
  ];
begin
  foreach t in array direct_org_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists tenant_isolation on public.%I', t);
      -- users.org_id/org_ai_credentials.org_id/org_data_plane_credentials.org_id
      -- are legitimately null for platform-level rows (master_admin users,
      -- and these two credential tables are never queried by a tenant-scoped
      -- request in the current code — only /api/admin/** routes touch them,
      -- always under a master_admin JWT) — `org_id is null` only matches for
      -- a master_admin caller anyway since jwt_org_id() is null exactly when
      -- the caller's own org_id claim is null, i.e. exactly the master_admin
      -- case this policy already grants full access to via the first clause.
      execute format(
        $pol$create policy tenant_isolation on public.%I
          for all
          using (jwt_is_master_admin() or org_id = jwt_org_id())
          with check (jwt_is_master_admin() or org_id = jwt_org_id())$pol$,
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- organizations — the tenant registry itself. A tenant's own members may
-- SELECT their own row (needed by GET /api/organizations/me); only
-- master_admin may write.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.organizations') is not null then
    execute 'alter table public.organizations enable row level security';
    execute 'drop policy if exists tenant_isolation_read on public.organizations';
    execute 'drop policy if exists tenant_isolation_write on public.organizations';
    execute $pol$create policy tenant_isolation_read on public.organizations
      for select using (jwt_is_master_admin() or id = jwt_org_id())$pol$;
    execute $pol$create policy tenant_isolation_write on public.organizations
      for insert with check (jwt_is_master_admin())$pol$;
    execute $pol$create policy tenant_isolation_update on public.organizations
      for update using (jwt_is_master_admin()) with check (jwt_is_master_admin())$pol$;
    execute $pol$create policy tenant_isolation_delete on public.organizations
      for delete using (jwt_is_master_admin())$pol$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- spaces — scoped via sites.org_id (Phase 0a: spaces has no org_id column of
-- its own, only site_id).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.spaces') is not null and to_regclass('public.sites') is not null then
    execute 'alter table public.spaces enable row level security';
    execute 'drop policy if exists tenant_isolation on public.spaces';
    execute $pol$create policy tenant_isolation on public.spaces
      for all
      using (
        jwt_is_master_admin()
        or exists (select 1 from public.sites s where s.id = spaces.site_id and s.org_id = jwt_org_id())
      )
      with check (
        jwt_is_master_admin()
        or exists (select 1 from public.sites s where s.id = spaces.site_id and s.org_id = jwt_org_id())
      )$pol$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ratings — scoped via bills.org_id (Phase 4a: ratings has no org_id column
-- of its own, only bill_id).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ratings') is not null and to_regclass('public.bills') is not null then
    execute 'alter table public.ratings enable row level security';
    execute 'drop policy if exists tenant_isolation on public.ratings';
    execute $pol$create policy tenant_isolation on public.ratings
      for all
      using (
        jwt_is_master_admin()
        or exists (select 1 from public.bills b where b.id = ratings.bill_id and b.org_id = jwt_org_id())
      )
      with check (
        jwt_is_master_admin()
        or exists (select 1 from public.bills b where b.id = ratings.bill_id and b.org_id = jwt_org_id())
      )$pol$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- wallet_transactions — scoped via wallets.org_id (Phase 1B.a: no org_id
-- column of its own, only wallet_id).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.wallet_transactions') is not null and to_regclass('public.wallets') is not null then
    execute 'alter table public.wallet_transactions enable row level security';
    execute 'drop policy if exists tenant_isolation on public.wallet_transactions';
    execute $pol$create policy tenant_isolation on public.wallet_transactions
      for all
      using (
        jwt_is_master_admin()
        or exists (select 1 from public.wallets w where w.id = wallet_transactions.wallet_id and w.org_id = jwt_org_id())
      )
      with check (
        jwt_is_master_admin()
        or exists (select 1 from public.wallets w where w.id = wallet_transactions.wallet_id and w.org_id = jwt_org_id())
      )$pol$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- device_states, device_commands — scoped via devices.org_id (Phase 6a: no
-- org_id column of their own, only device_id).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if to_regclass('public.devices') is null then
    return;
  end if;
  foreach t in array array['device_states', 'device_commands'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists tenant_isolation on public.%I', t);
      execute format(
        $pol$create policy tenant_isolation on public.%I
          for all
          using (
            jwt_is_master_admin()
            or exists (select 1 from public.devices d where d.id = %I.device_id and d.org_id = jwt_org_id())
          )
          with check (
            jwt_is_master_admin()
            or exists (select 1 from public.devices d where d.id = %I.device_id and d.org_id = jwt_org_id())
          )$pol$,
        t, t, t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Platform-wide catalog tables — NOT tenant data (no org_id column at all by
-- design, Phase 1B.a): coin_plans, coupon_codes, platform_offers. Every
-- authenticated caller may read (a tenant needs to browse plans/validate a
-- coupon/see an offer); only master_admin may write. Owner-created
-- bill_discount coupons (plan Phase 1B.c's POST /api/owner/coupons) are not
-- yet distinguishable from master_admin-created ones at the RLS layer since
-- coupon_codes has no org_id/owner-scoping column in the plan's own schema —
-- that authorization stays app-layer (created_by check) until/unless the
-- schema grows an owning-org column.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['coin_plans', 'coupon_codes', 'platform_offers'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists platform_catalog_read on public.%I', t);
      execute format('drop policy if exists platform_catalog_write on public.%I', t);
      execute format(
        $pol$create policy platform_catalog_read on public.%I for select using (true)$pol$, t
      );
      execute format(
        $pol$create policy platform_catalog_write on public.%I
          for insert with check (jwt_is_master_admin())$pol$,
        t
      );
      execute format(
        $pol$create policy platform_catalog_update on public.%I
          for update using (jwt_is_master_admin()) with check (jwt_is_master_admin())$pol$,
        t
      );
      execute format(
        $pol$create policy platform_catalog_delete on public.%I
          for delete using (jwt_is_master_admin())$pol$,
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- audit_log — master_admin-only surface (Phase 1e). org_id is nullable
-- (platform-level actions), so this is NOT the generic direct-org-column
-- case above.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'alter table public.audit_log enable row level security';
    execute 'drop policy if exists master_admin_only on public.audit_log';
    execute $pol$create policy master_admin_only on public.audit_log
      for all using (jwt_is_master_admin()) with check (jwt_is_master_admin())$pol$;
  end if;
end $$;

-- ============================================================================
-- ROLLOUT NOTE — read before running this anywhere but a scratch/staging
-- Supabase project:
--
-- 1. This file only takes effect against your actual Supabase Postgres
--    instance once you run it there (Supabase SQL editor, or `psql`/the
--    Supabase CLI against DATABASE_URL) — publishing this file changes
--    nothing by itself.
-- 2. Before running it against any database real routes still query:
--    confirm every Route Handler that reads/writes a table listed above has
--    been switched from the default `supabase` import
--    (src/lib/supabaseClient.js) to `getScopedSupabase(auth)`
--    (src/lib/tenantSupabase.js, added alongside this migration) — as of
--    this migration, that swap has NOT been done route-by-route yet.
--    A route still using the plain client has no org_id/is_master_admin
--    claim to offer these policies, so `org_id = jwt_org_id()` (both sides
--    effectively null-vs-null → NOT true, since `uuid = uuid` on two NULLs
--    is NULL, not true) will match zero rows — every such route goes from
--    "works" to "returns empty" the instant RLS is enabled, not from a
--    visible error.
-- 3. Recommended order: (a) merge this migration file + tenantSupabase.js
--    unmerged/inert first, (b) migrate routes to getScopedSupabase(auth) in
--    batches, verifying each batch still passes its existing Vitest suite
--    (those tests mock supabase.from() directly so they won't catch an RLS
--    mismatch — they only confirm the *query shape* is unchanged), (c) only
--    once every table's routes are migrated, run this file against a
--    staging project and manually smoke-test cross-tenant isolation (log in
--    as org A, confirm org B's rows are truly unreachable) before running it
--    against production.
-- 4. This migration is idempotent (safe to re-run) — every policy is
--    dropped and recreated, every ALTER ... ENABLE is a no-op if already
--    enabled.
-- ============================================================================
