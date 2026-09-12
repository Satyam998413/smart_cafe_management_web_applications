import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

// PATCH /api/admin/organizations/[id]/domain — ported from
// adminController.js's setCustomDomain. Master Admin only.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { customDomain } = await request.json();
    if (!customDomain) {
      return NextResponse.json({ message: 'customDomain is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ custom_domain: customDomain })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'That domain is already in use by another organization' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'domain_changed',
      targetType: 'organization',
      targetId: id,
      metadata: { customDomain }
    });

    return NextResponse.json(serializeOrganization(data));
  } catch (error) {
    logger.error('Failed to set custom domain', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
