import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { serializeUser } from '@/lib/serializers.js';

// GET /api/admin/users?role=...&search=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    let query = supabase
      .from('users')
      .select('*, org:organizations(id, name, premise_type)')
      .order('created_at', { ascending: false });

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data.map(serializeUser));
  } catch (error) {
    logger.error('Failed to list admin users', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/users (Master Admin creates user)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const body = await request.json();
    const { name, email, phone, role, password, orgId } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ message: 'name, email, and role are required' }, { status: 400 });
    }

    // Platform-level roles have NO organization assigned
    const PLATFORM_ROLES = ['master_admin', 'technician', 'salesman'];
    const isPlatformRole = PLATFORM_ROLES.includes(role);

    let targetOrgId = isPlatformRole ? null : (orgId || null);

    if (!isPlatformRole && role !== 'customer' && !targetOrgId) {
      return NextResponse.json({ message: `Organization assignment is required for ${role} role` }, { status: 400 });
    }

    const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name,
        email,
        phone: phone || null,
        role,
        org_id: targetOrgId,
        password_hash: passwordHash
      })
      .select('*, org:organizations(id, name, premise_type)')
      .single();

    if (error) throw error;

    logger.info('Master admin created user', { userId: user.id, role, orgId: targetOrgId });
    return NextResponse.json(serializeUser(user), { status: 201 });
  } catch (error) {
    logger.error('Failed to create user', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/users (Master Admin updates user role / org)
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const body = await request.json();
    const { userId, role, orgId, password } = body;

    if (!userId) {
      return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    }

    const PLATFORM_ROLES = ['master_admin', 'technician', 'salesman'];
    const updateData = {};

    if (role) {
      updateData.role = role;
      if (PLATFORM_ROLES.includes(role)) {
        updateData.org_id = null; // Unassign org for platform roles
      }
    }

    if (orgId !== undefined && !PLATFORM_ROLES.includes(role)) {
      updateData.org_id = orgId || null;
    }

    if (password) {
      updateData.password_hash = bcrypt.hashSync(password, 10);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('*, org:organizations(id, name, premise_type)')
      .single();

    if (error) throw error;

    logger.info('Updated user details', { userId, updatedBy: auth.userId });
    return NextResponse.json(serializeUser(user));
  } catch (error) {
    logger.error('Failed to update user', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
