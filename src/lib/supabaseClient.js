import { createClient } from '@supabase/supabase-js';

// Ported unchanged from server/src/config/supabaseClient.js as part of the
// Next.js migration (plan Phase 10) — same env vars, same trust model (only
// this server-side module ever holds the anon key; no client component
// imports this file).
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default supabase;

// Per-request client carrying a self-signed tenant JWT instead of the bare
// anon key (plan Phase 0c) — ported from the Express app's named export of
// the same name for when RLS/tenantContext is migrated over.
export const createScopedClient = (tenantJwt) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tenantJwt}` } }
  });
