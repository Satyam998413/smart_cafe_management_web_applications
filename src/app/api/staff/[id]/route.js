import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { STAFF_ROLES } from '@/lib/staffHelpers.js';

// PATCH /api/staff/[id] — ported from staffController.js's updateStaff.
// Updates a cook/manager/waiter's profile fields (never role or password here).
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, email, phone } = await request.json();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    const { data, error } = await scopeToOrg(
      supabase.from('users').update(updates).eq('id', id).in('role', STAFF_ROLES),
      auth.orgId
    )
      .select('*')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json({ message: 'Staff account not found' }, { status: 404 });
    }

    return NextResponse.json(serializeUser(data));
  } catch (error) {
    logger.error('Failed to update staff account', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
