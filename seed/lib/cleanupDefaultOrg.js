import { DEFAULT_ORG, DEFAULT_USERS } from '../constants.js';

const SEED_USER_EMAILS = DEFAULT_USERS.map((user) => user.email);

/**
 * Removes exactly what seed.js creates — scoped to the default org (looked
 * up by its unique contact_email, not a hardcoded id) plus every seed user
 * email. Used by both clean.js directly and by seed.js (to make reseeding
 * idempotent) so the two scripts can never drift on what "default data"
 * means.
 *
 * Deliberately does NOT truncate whole tables (this is a shared multi-tenant
 * database — other orgs' rows must survive) and does NOT touch coin_plans
 * (platform-wide catalog, not org-scoped, possibly referenced by other
 * orgs' coin_purchases).
 *
 * Only `menu_items` and `users` are deleted explicitly before the
 * `organizations` row: their org_id foreign keys have no ON DELETE CASCADE
 * (server/supabase/schema.sql), so they'd otherwise block the delete.
 * Everything else the org owns (sites -> spaces, wallets ->
 * wallet_transactions, delivery_riders, delivery_zones, devices) cascades
 * away automatically once the organizations row is deleted.
 */
export async function cleanupDefaultOrgData(client) {
  const summary = { menuItems: 0, users: 0, organizations: 0 };

  const { data: org, error: orgLookupError } = await client
    .from('organizations')
    .select('id')
    .eq('contact_email', DEFAULT_ORG.contactEmail)
    .maybeSingle();
  if (orgLookupError) throw orgLookupError;

  if (org) {
    const { count: menuItemsDeleted, error: menuError } = await client
      .from('menu_items')
      .delete({ count: 'exact' })
      .eq('org_id', org.id);
    if (menuError) throw menuError;
    summary.menuItems = menuItemsDeleted || 0;

    const { count: orgUsersDeleted, error: usersError } = await client
      .from('users')
      .delete({ count: 'exact' })
      .eq('org_id', org.id);
    if (usersError) throw usersError;
    summary.users += orgUsersDeleted || 0;

    const { error: orgDeleteError } = await client.from('organizations').delete().eq('id', org.id);
    if (orgDeleteError) throw orgDeleteError;
    summary.organizations = 1;
  }

  // master_admin's org_id is null (platform-level), so it's never caught by
  // the org-scoped delete above — remove it (and any other null-org_id seed
  // account) by its known email instead.
  const { count: platformUsersDeleted, error: platformUsersError } = await client
    .from('users')
    .delete({ count: 'exact' })
    .in('email', SEED_USER_EMAILS)
    .is('org_id', null);
  if (platformUsersError) throw platformUsersError;
  summary.users += platformUsersDeleted || 0;

  return { orgId: org?.id ?? null, ...summary };
}
