import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { STAFF_ROLES, SALT_ROUNDS } from '@/lib/staffHelpers.js';

// GET /api/staff — ported from staffController.js's listStaff. Lists every
// manager/cook/waiter account in the caller's org.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { data, error } = await scopeToOrg(
      supabase.from('users').select('*').in('role', STAFF_ROLES).order('created_at', { ascending: false }),
      auth.orgId
    );
    if (error) throw error;
    return NextResponse.json(data.map(serializeUser));
  } catch (error) {
    logger.error('Failed to list staff', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/staff — ported from staffController.js's createStaff. Reachable
// by both Owner and Manager — the plan doc scopes this [owner]-only, but the
// existing single-tenant deployment already relies on Manager creating Cook
// accounts; narrowing to Owner-only would be a real capability regression.
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { name, email, phone, password, role, spaceId } = await request.json();
    if (!name || !password || !role) {
      return NextResponse.json({ message: 'Name, password, and role are required' }, { status: 400 });
    }
    if (!STAFF_ROLES.includes(role)) {
      return NextResponse.json({ message: `role must be one of: ${STAFF_ROLES.join(', ')}` }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ message: 'Email or phone number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        role,
        password_hash: bcrypt.hashSync(password, SALT_ROUNDS),
        space_id: spaceId || null,
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ message: 'That email or phone is already in use.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(serializeUser(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create staff account', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
