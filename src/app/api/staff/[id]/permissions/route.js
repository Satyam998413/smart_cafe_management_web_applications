import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';

// The only two grantable permission flags that exist anywhere in this
// codebase today (plan Phase 2b/2d): a Manager needs an explicit Owner
// grant for either. Whitelisted by construction, same reasoning as
// serializeUser's whitelist — an unrecognized key in the request body is
// silently ignored rather than blindly merged into the jsonb column.
const GRANTABLE_PERMISSIONS = ['canResetStaffPassword', 'canControlIot'];

// PATCH /api/staff/[id]/permissions — Owner grants/revokes a Manager's
// permission flags. Genuinely missing before this: users.permissions was
// readable (staffHelpers.js's canResetPassword, the IoT commands route) but
// had no write path anywhere — granting was DB-only. Owner-only, and only
// for a Manager target (Cook/Waiter have no permission flags to grant —
// nothing reads permissions for them).
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const body = await request.json();

    const { data: target, error: fetchError } = await scopeToOrg(
      supabase.from('users').select('*').eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (fetchError) throw fetchError;
    if (!target) return NextResponse.json({ message: 'Staff account not found' }, { status: 404 });
    if (target.role !== 'manager') {
      return NextResponse.json({ message: 'Only a Manager has grantable permissions' }, { status: 400 });
    }

    const nextPermissions = { ...(target.permissions || {}) };
    for (const key of GRANTABLE_PERMISSIONS) {
      if (body[key] !== undefined) nextPermissions[key] = Boolean(body[key]);
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ permissions: nextPermissions })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'permissions_changed',
      targetType: 'user',
      targetId: id,
      metadata: { permissions: nextPermissions }
    });

    return NextResponse.json(serializeUser(updated));
  } catch (error) {
    logger.error('Failed to update staff permissions', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
