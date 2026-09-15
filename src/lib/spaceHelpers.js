import supabase from './supabaseClient.js';

export const SPACE_KINDS = ['floor', 'hall', 'table', 'room', 'canteen', 'gallery', 'corridor', 'pickup_station', 'building'];

export const assertSiteInOrg = async (siteId, orgId) => {
  const { data: site, error } = await supabase.from('sites').select('org_id').eq('id', siteId).maybeSingle();
  if (error) throw error;
  if (!site) return false;
  if (orgId && site.org_id !== orgId) return false;
  return true;
};
