import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { STAFF_ROLES } from '@/lib/staffHelpers.js';

// PATCH /api/staff/[id]/assignment — ported from staffController.js's
// assignStaff (plan Phase 2c). users has no separate site_id column — a
// space always implies its site via spaces.site_id, so assignment is
// expressed as space_id alone. Pass spaceId: null to unassign.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { spaceId } = await request.json();
    if (spaceId === undefined) {
      return NextResponse.json({ message: 'spaceId is required (pass null to unassign)' }, { status: 400 });
    }

    if (spaceId !== null) {
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .select('id, site:sites(org_id)')
        .eq('id', spaceId)
        .maybeSingle();
      if (spaceError) throw spaceError;
      if (!space || (auth.orgId && space.site.org_id !== auth.orgId)) {
        return NextResponse.json({ message: 'Space not found' }, { status: 404 });
      }
    }

    const { data, error } = await scopeToOrg(
      supabase.from('users').update({ space_id: spaceId }).eq('id', id).in('role', STAFF_ROLES),
      auth.orgId
    )
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Staff account not found' }, { status: 404 });

    return NextResponse.json(serializeUser(data));
  } catch (error) {
    logger.error('Failed to assign staff', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
