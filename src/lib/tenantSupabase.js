import jwt from 'jsonwebtoken';
import supabase, { createScopedClient } from './supabaseClient.js';

/**
 * Phase 0c's per-request tenant JWT (plan/multi-tenant-platform-master-plan.md
 * Phase 0c) — mints a short-lived, Supabase-project-compatible JWT signed
 * with SUPABASE_JWT_SECRET (a real secret this project already holds and
 * already uses one-way, to *verify* Supabase Auth's Google tokens in
 * src/app/api/auth/google/route.js). This is the other direction: *issuing*
 * one ourselves so PostgREST has something to resolve RLS policies from,
 * instead of every query going out under the bare anon key.
 *
 * Claim shape matches what Phase 0c's RLS policies (see
 * supabase/migrations/0001_enable_row_level_security.sql) read via
 * `current_setting('request.jwt.claims', true)::json ->> 'org_id'` and
 * `... ->> 'is_master_admin'`. `role: 'authenticated'` is the fixed Postgres
 * role name PostgREST switches to for any signed-in request — org/master-admin
 * scoping is entirely policy-driven from the extra claims, not a second
 * Postgres role.
 */
export function mintTenantJwt({ orgId = null, isMasterAdmin = false } = {}) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      role: 'authenticated',
      org_id: orgId,
      is_master_admin: Boolean(isMasterAdmin)
    },
    secret,
    { expiresIn: '5m' }
  );
}

/**
 * Convenience wrapper a Route Handler can drop in for the default `supabase`
 * import once it's ready to run under RLS: `getScopedSupabase(auth)` instead
 * of `supabase`. Falls back to the plain client (today's behavior, still
 * correct pre-RLS since app-layer scopeToOrg is the only enforcement so far)
 * when SUPABASE_JWT_SECRET isn't configured or `auth` wasn't resolved — so
 * adopting this per-route is a no-op until both (a) this env var is set and
 * (b) RLS is actually enabled on a table, making the swap itself safe to do
 * ahead of flipping RLS on.
 *
 * `auth` is whatever requireAuth()/optionalAuth() (src/lib/auth.js) returned
 * — only `orgId`/`isMasterAdmin` are read. Always returns a usable client
 * (never null) so call sites don't need a fallback of their own.
 */
export function getScopedSupabase(auth) {
  const token = auth && mintTenantJwt({ orgId: auth.orgId, isMasterAdmin: auth.isMasterAdmin });
  return token ? createScopedClient(token) : supabase;
}
