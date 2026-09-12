-- Rolls back 0001_enable_row_level_security.sql's enforcement, without
-- dropping any of its policies.
--
-- WHY: 0001 turned RLS on for real, but its own rollout note said not to do
-- that until every Route Handler querying an affected table was migrated
-- from the plain `supabase` client (src/lib/supabaseClient.js) to
-- getScopedSupabase(auth) (src/lib/tenantSupabase.js). That migration never
-- happened — grepping the codebase (2026-09-13) finds getScopedSupabase used
-- nowhere outside its own definition/test. Separately, SUPABASE_JWT_SECRET
-- in .env doesn't match a key this project's PostgREST verifies with
-- (every mintTenantJwt-signed request fails PGRST301 "No suitable key or
-- wrong key type"), so even a migrated route couldn't clear RLS yet either.
-- Net effect discovered while reseeding: every route using the plain client
-- silently got zero rows back from any RLS-covered table — most visibly,
-- POST /api/auth/staff-login could never find a real user row, so no staff
-- login could ever succeed.
--
-- This migration disables RLS on exactly the tables 0001 enabled it for,
-- restoring today's actual trust model (app-layer `.eq('org_id', ...)`
-- filtering only, per src/lib/tenantScope.js) until both of the above are
-- actually fixed. Every policy from 0001 stays defined (just inert) — this
-- file's counterpart, re-running `alter table ... enable row level
-- security`, is the entire job of turning it back on once the route
-- migration is real and SUPABASE_JWT_SECRET is corrected. Guarded with
-- to_regclass so it's safe to run against a database missing some of these
-- tables (confirmed on this project: devices, device_states,
-- device_commands, org_ai_credentials, org_data_plane_credentials don't
-- exist here).

do $$
declare
  t text;
  rls_tables text[] := array[
    'sites', 'users', 'menu_items', 'orders', 'order_messages',
    'manager_cook_messages', 'device_tokens', 'menu_item_option_groups',
    'bills', 'wallets', 'coin_purchases', 'coupon_redemptions',
    'notifications', 'devices', 'delivery_riders', 'delivery_zones',
    'accounting_exports', 'org_ai_credentials', 'org_data_plane_credentials',
    'organizations', 'spaces', 'ratings', 'wallet_transactions',
    'device_states', 'device_commands', 'coin_plans', 'coupon_codes',
    'platform_offers', 'audit_log'
  ];
begin
  foreach t in array rls_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I disable row level security', t);
    end if;
  end loop;
end $$;
