import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSite } from '@/lib/serializers.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// PATCH /api/sites/[id] — genuinely missing from the ported API surface
// (siteController.js only ever had list/create — see route.js's GET/POST);
// the Sites page (plan Phase 2a) needs to edit a site's basics
// (name/address), so it's added here in the same thin-handler style as
// PATCH /api/spaces/[id]. Owner only, matching POST /api/sites' gating.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, address, lat, lng, googleBusinessProfileUrl } = await request.json();

    const { data: existing, error: fetchError } = await supabase.from('sites').select('org_id').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing || (auth.orgId && existing.org_id !== auth.orgId)) {
      return NextResponse.json({ message: 'Site not found' }, { status: 404 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (googleBusinessProfileUrl !== undefined) updates.google_business_profile_url = googleBusinessProfileUrl;

    const { data, error } = await supabase.from('sites').update(updates).eq('id', id).select('*').single();
    if (error) throw error;

    return NextResponse.json(serializeSite(data));
  } catch (error) {
    logger.error('Failed to update site', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
