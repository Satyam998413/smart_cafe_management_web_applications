import { createClient } from '@supabase/supabase-js';

/**
 * A Supabase client for CLI scripts only (seed.js/clean.js/clean-all.js),
 * using the project's service_role key — the only thing that reliably
 * bypasses RLS regardless of how a given project signs/verifies JWTs.
 *
 * Two things were tried and ruled out first:
 * 1. Minting a master_admin JWT via src/lib/tenantSupabase.js
 *    (SUPABASE_JWT_SECRET) — rejected outright by PostgREST (PGRST301 "No
 *    suitable key or wrong key type"): the secret in .env doesn't match a
 *    key this project's PostgREST verifies with.
 * 2. Falling back to the plain anon client — initially looked like it had
 *    full access (SELECT/DELETE against organizations returned success),
 *    but that was RLS silently matching zero rows, not RLS being off:
 *    INSERT correctly raised "new row violates row-level security policy",
 *    which SELECT/DELETE's `using` clauses don't do — they just filter.
 *    RLS is genuinely enforced here.
 */
export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) must be set in .env for seed/clean scripts to write past RLS. ' +
        'Get it from the Supabase dashboard: Project Settings > API > Project API keys > service_role (secret). ' +
        'Never expose this key to a browser/client — it bypasses RLS entirely.'
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
