import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

const MANAGE_ROLES = ['owner', 'manager', 'technician', 'master_admin'];

// GET /api/access-grants?lockId=&userId= — who's allowed to open a given
// lock, or which locks a given user can open (per-user-per-lock granularity
// — the product decision this was built against, see migration 0020's
// access_grants table comment).
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, ...MANAGE_ROLES);
  if (roleError) return roleError;

  try {
    const { searchParams } = new URL(request.url);
    const lockId = searchParams.get('lockId');
    const userId = searchParams.get('userId');
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    if (!lockId && !userId) {
      return NextResponse.json({ message: 'lockId or userId is required' }, { status: 400 });
    }

    let query = supabase.from('access_grants').select('*, user:users(id, name, email), lock:smart_locks(id, lock_name)').eq('org_id', targetOrgId);
    if (lockId) query = query.eq('lock_id', lockId);
    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to list access grants', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/access-grants { userId, lockId } — grant a user access to a
// lock. 409s on the (user_id, lock_id) unique constraint, same pattern as
// every other duplicate-registration route in this codebase.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, ...MANAGE_ROLES);
  if (roleError) return roleError;

  try {
    const { userId, lockId } = await request.json();
    if (!userId || !lockId) {
      return NextResponse.json({ message: 'userId and lockId are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('access_grants')
      .insert({ org_id: auth.orgId, user_id: userId, lock_id: lockId, granted_by: auth.userId })
      .select('*, user:users(id, name, email), lock:smart_locks(id, lock_name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'This user already has access to this lock.' }, { status: 409 });
      }
      throw error;
    }

    logger.info('Access grant created', { userId, lockId, grantedBy: auth.userId });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    logger.error('Failed to create access grant', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/access-grants { userId, lockId } — revoke: the grant simply
// stops existing (no soft-revoke/status column, see migration 0020).
export async function DELETE(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, ...MANAGE_ROLES);
  if (roleError) return roleError;

  try {
    const { userId, lockId } = await request.json();
    if (!userId || !lockId) {
      return NextResponse.json({ message: 'userId and lockId are required' }, { status: 400 });
    }

    const { error } = await supabase.from('access_grants').delete().eq('user_id', userId).eq('lock_id', lockId).eq('org_id', auth.orgId);
    if (error) throw error;

    logger.info('Access grant revoked', { userId, lockId, revokedBy: auth.userId });
    return NextResponse.json({ message: 'Access revoked' });
  } catch (error) {
    logger.error('Failed to revoke access grant', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
