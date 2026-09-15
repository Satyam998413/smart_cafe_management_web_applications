import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { ALL_ORG_ROLES, SALT_ROUNDS } from '@/lib/staffHelpers.js';
import { isValidEmail, isValidPhone } from '@/lib/validators.js';
import { logAudit } from '@/lib/auditLog.js';

// PATCH /api/admin/organizations/[id]/staff/[staffId] — Master Admin updates staff member
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id, staffId } = await params;
    const body = await request.json();

    const { data: staff, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', staffId)
      .eq('org_id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!staff) {
      return NextResponse.json({ message: 'Staff member not found in this organization' }, { status: 404 });
    }

    const updates = {};
    if (body.name !== undefined) updates.name = body.name;

    if (body.email !== undefined && body.email) {
      if (!isValidEmail(body.email)) {
        return NextResponse.json({ message: 'Invalid email address format' }, { status: 400 });
      }
      updates.email = body.email;
    } else if (body.email === null || body.email === '') {
      updates.email = null;
    }

    if (body.phone !== undefined && body.phone) {
      if (!isValidPhone(body.phone)) {
        return NextResponse.json({ message: 'Mobile number must be a valid 10-digit number' }, { status: 400 });
      }
      updates.phone = body.phone;
    } else if (body.phone === null || body.phone === '') {
      updates.phone = null;
    }

    if (body.spaceId !== undefined) updates.space_id = body.spaceId || null;

    if (body.role !== undefined) {
      if (!ALL_ORG_ROLES.includes(body.role)) {
        return NextResponse.json({ message: `role must be one of: ${ALL_ORG_ROLES.join(', ')}` }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.password) {
      updates.password_hash = bcrypt.hashSync(body.password, SALT_ROUNDS);
    }

    if (body.permissions !== undefined && typeof body.permissions === 'object') {
      updates.permissions = {
        ...(staff.permissions || {}),
        ...body.permissions
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', staffId)
      .select('*')
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
      }
      throw updateError;
    }

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'staff_updated_by_admin',
      targetType: 'user',
      targetId: staffId,
      metadata: { updates: Object.keys(updates) }
    });

    return NextResponse.json(serializeUser(updated));
  } catch (error) {
    logger.error('Failed to update staff member by admin', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/admin/organizations/[id]/staff/[staffId] — Master Admin deletes staff member
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id, staffId } = await params;

    const { data: staff, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', staffId)
      .eq('org_id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!staff) {
      return NextResponse.json({ message: 'Staff member not found in this organization' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', staffId);

    if (deleteError) throw deleteError;

    await logAudit({
      orgId: id,
      actorId: auth.userId,
      actorRole: auth.userRole,
      action: 'staff_deleted_by_admin',
      targetType: 'user',
      targetId: staffId,
      metadata: { role: staff.role, name: staff.name }
    });

    return NextResponse.json({ message: 'Staff member removed successfully' });
  } catch (error) {
    logger.error('Failed to delete staff member by admin', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
