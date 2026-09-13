import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — the only client in this codebase that
 * bypasses RLS/Storage policies unconditionally, regardless of the ongoing
 * RLS enable/disable situation (see supabase/migrations/0002's rollback
 * note and seed/lib/supabaseAdmin.js's own comment, which first established
 * this pattern for CLI scripts). This copy exists in src/lib specifically
 * so real Route Handlers can import it too — seed/lib's version documents
 * itself as "CLI scripts only" and isn't meant to be imported by app code.
 *
 * Used for: Supabase Storage uploads (src/app/api/uploads/route.js). Not
 * used, and must never be used, for ordinary table reads/writes that should
 * stay tenant-scoped — those go through the default `supabase` export
 * (src/lib/supabaseClient.js) plus scopeToOrg, same as every other route.
 */
export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) must be set in .env for storage uploads. ' +
        'Get it from the Supabase dashboard: Project Settings > API > Project API keys > service_role (secret). ' +
        'Never expose this key to a browser/client.'
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
