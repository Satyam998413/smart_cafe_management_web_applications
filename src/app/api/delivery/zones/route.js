import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeDeliveryZone } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/delivery/zones — ported from deliveryController.js's listZones.
// Owner or Manager. Lists my org's delivery zones (pincode -> fee/ETA).
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('delivery_zones').select('*').order('pincode', { ascending: true }),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data.map(serializeDeliveryZone));
  } catch (error) {
    logger.error('Failed to list delivery zones', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/delivery/zones — ported from deliveryController.js's
// upsertZone. Owner or Manager. Upsert by (site_id, pincode): re-posting
// the same site+pincode updates its fee/ETA rather than erroring, since
// that's the natural "edit a zone" UX (no separate PATCH-by-id needed for
// two fields).
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { siteId, pincode, deliveryFee, etaMinutes } = await request.json();
    if (!siteId || !pincode) {
      return NextResponse.json({ message: 'siteId and pincode are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('delivery_zones')
      .upsert(
        {
          site_id: siteId,
          pincode,
          delivery_fee: deliveryFee ?? 0,
          eta_minutes: etaMinutes ?? null,
          ...(auth.orgId ? { org_id: auth.orgId } : {})
        },
        { onConflict: 'site_id,pincode' }
      )
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeDeliveryZone(data));
  } catch (error) {
    logger.error('Failed to upsert delivery zone', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
