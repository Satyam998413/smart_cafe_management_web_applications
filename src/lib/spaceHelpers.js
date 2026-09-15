import supabase from './supabaseClient.js';

export const SPACE_KINDS = ['floor', 'hall', 'table', 'room', 'canteen', 'gallery'];

// spaces carries no org_id of its own (scoped via site_id -> sites.org_id,
// same reasoning as order_items/menu_item_option_choices in
// rls_policies.sql) — this is the defense-in-depth equivalent of that
// join-based RLS policy, checked once here rather than duplicated in every
// handler. Ported from server/src/controllers/spaceController.js.
export const assertSiteInOrg = async (siteId, orgId) => {
  const { data: site, error } = await supabase.from('sites').select('org_id').eq('id', siteId).maybeSingle();
  if (error) throw error;
  if (!site) return false;
  if (orgId && site.org_id !== orgId) return false;
  return true;
};
