import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSite } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/sites — ported from siteController.js's listSites. An org's
// branches/properties (plan Phase 2a).
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('sites').select('*').order('created_at', { ascending: false }),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data.map(serializeSite));
  } catch (error) {
    logger.error('Failed to list sites', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/sites — ported from siteController.js's createSite. Owner only.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { name, address, lat, lng, googleBusinessProfileUrl } = await request.json();
    if (!name) {
      return NextResponse.json({ message: 'name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('sites')
      .insert({
        name,
        address: address || null,
        lat: lat ?? null,
        lng: lng ?? null,
        google_business_profile_url: googleBusinessProfileUrl || null,
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeSite(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create site', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
