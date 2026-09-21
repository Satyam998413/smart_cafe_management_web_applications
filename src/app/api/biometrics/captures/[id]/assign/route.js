import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { assignBiometricCapture } from '@/lib/deviceEvents.js';
import { serializeUser } from '@/lib/serializers.js';
import { STAFF_ROLES, createStaffAccount } from '@/lib/staffHelpers.js';

// POST /api/biometrics/captures/:id/assign — the manager screen's core
// action. Body is either `{ userId }` (pick an existing staff member) or
// `{ newUser: { name, email, phone, password, role } }` (create one inline,
// reusing the exact insert logic /api/staff's POST uses — see
// staffHelpers.js's createStaffAccount) — either way, ends with the same
// assignBiometricCapture call turning the capture into that user's actual
// verification credential.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager', 'technician', 'master_admin');
  if (roleError) return roleError;

  try {
    const { id: captureId } = await params;
    const body = await request.json();

    let userId = body.userId;
    if (!userId && body.newUser) {
      const { name, email, phone, password, role } = body.newUser;
      if (!name || !password || !role) {
        return NextResponse.json({ message: 'newUser requires name, password, and role' }, { status: 400 });
      }
      if (!STAFF_ROLES.includes(role)) {
        return NextResponse.json({ message: `role must be one of: ${STAFF_ROLES.join(', ')}` }, { status: 400 });
      }
      const created = await createStaffAccount({ orgId: auth.orgId, name, email, phone, password, role });
      userId = created.id;
    }

    if (!userId) {
      return NextResponse.json({ message: 'userId or newUser is required' }, { status: 400 });
    }

    const capture = await assignBiometricCapture({ captureId, userId, assignedBy: auth.userId });

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    return NextResponse.json({ capture, user: user ? serializeUser(user) : null });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return NextResponse.json({ message: error.message }, { status: 404 });
    if (error.code === 'ALREADY_ASSIGNED' || error.code === 'NOT_READY') {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error.code === '23505') {
      return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
    }
    logger.error('Failed to assign biometric capture', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
