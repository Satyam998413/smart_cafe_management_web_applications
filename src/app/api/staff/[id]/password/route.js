import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { logAudit } from '@/lib/auditLog.js';
import { canResetPassword, SALT_ROUNDS } from '@/lib/staffHelpers.js';

// PATCH /api/staff/[id]/password — ported from staffController.js's
// resetStaffPassword. See staffHelpers.js's canResetPassword for who can
// reset whom. No current-password check (this is an admin override, not a
// self-service change), and every reset is audit-logged (Phase 1e).
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'master_admin', 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ message: 'newPassword must be at least 6 characters' }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabase
      .from('users')
      .select('id, role, org_id')
      .eq('id', id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

    // Fetched fresh, not trusted from the JWT — an Owner can grant/revoke a
    // Manager's canResetStaffPassword permission at any time, and that
    // change should take effect immediately, not only after the Manager's
    // token is next re-signed.
    let actorPermissions = {};
    if (auth.userRole === 'manager') {
      const { data: actor, error: actorError } = await supabase
        .from('users')
        .select('permissions')
        .eq('id', auth.userId)
        .maybeSingle();
      if (actorError) throw actorError;
      actorPermissions = actor?.permissions || {};
    }

    const allowed = canResetPassword({
      isMasterAdmin: auth.isMasterAdmin,
      actorRole: auth.userRole,
      actorOrgId: auth.orgId,
      actorPermissions,
      targetRole: target.role,
      targetOrgId: target.org_id
    });
    if (!allowed) {
      return NextResponse.json({ message: "Insufficient permissions to reset this account's password" }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: bcrypt.hashSync(newPassword, SALT_ROUNDS) })
      .eq('id', id);
    if (updateError) throw updateError;

    await logAudit({
      orgId: target.org_id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'password_reset',
      targetType: 'user',
      targetId: id
    });

    return NextResponse.json({ message: 'Password updated' });
  } catch (error) {
    logger.error('Failed to reset staff password', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
