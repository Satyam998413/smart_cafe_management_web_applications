import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { encryptCredential } from '@/lib/credentialCrypto.js';

const DATA_PLANE_TYPES = ['shared', 'byo_supabase'];

// PATCH /api/admin/organizations/[id]/data-plane — ported from
// adminController.js's setDataPlane. Master Admin only. Moves a tenant onto
// the Enterprise BYO-Supabase tier, or back onto the shared one (plan Phase
// 8). The anon key is encrypted the same way as AI credentials and never
// echoed back. Switching data_plane_type here doesn't itself migrate any
// existing data between projects — that's a real, separate, one-off
// operation for whoever operates this platform, not something this route
// attempts automatically.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { dataPlaneType, supabaseUrl, anonKey } = await request.json();
    if (!DATA_PLANE_TYPES.includes(dataPlaneType)) {
      return NextResponse.json({ message: `dataPlaneType must be one of: ${DATA_PLANE_TYPES.join(', ')}` }, { status: 400 });
    }
    if (dataPlaneType === 'byo_supabase' && (!supabaseUrl || !anonKey)) {
      return NextResponse.json({ message: 'supabaseUrl and anonKey are required for byo_supabase' }, { status: 400 });
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .update({ data_plane_type: dataPlaneType })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!org) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    if (dataPlaneType === 'byo_supabase') {
      const { error: credError } = await supabase.from('org_data_plane_credentials').upsert(
        {
          org_id: id,
          supabase_url: supabaseUrl,
          anon_key_encrypted: encryptCredential(anonKey),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'org_id' }
      );
      if (credError) throw credError;
    }

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'data_plane_changed',
      targetType: 'organization',
      targetId: id,
      metadata: { dataPlaneType }
    });

    return NextResponse.json(serializeOrganization(org));
  } catch (error) {
    logger.error('Failed to set data plane', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
