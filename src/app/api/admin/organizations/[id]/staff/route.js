import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { ALL_ORG_ROLES, SALT_ROUNDS } from '@/lib/staffHelpers.js';
import { isValidEmail, isValidPhone } from '@/lib/validators.js';

// GET /api/admin/organizations/[id]/staff — every owner/manager/cook/waiter account in one org
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;

    const { data: org, error: orgError } = await supabase.from('organizations').select('id').eq('id', id).maybeSingle();
    if (orgError) throw orgError;
    if (!org) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('org_id', id)
      .in('role', ALL_ORG_ROLES)
      .order('role', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json(data.map(serializeUser));
  } catch (error) {
    logger.error('Failed to list organization staff', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/admin/organizations/[id]/staff — provision an owner/manager/staff account for this org
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, email, phone, password, role = 'owner', spaceId, permissions } = await request.json();

    if (!name || !password || !role) {
      return NextResponse.json({ message: 'Name, password, and role are required' }, { status: 400 });
    }
    if (!ALL_ORG_ROLES.includes(role)) {
      return NextResponse.json({ message: `role must be one of: ${ALL_ORG_ROLES.join(', ')}` }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ message: 'Email or phone number is required' }, { status: 400 });
    }
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ message: 'Invalid email address format (e.g. user@example.com)' }, { status: 400 });
    }
    if (phone && !isValidPhone(phone)) {
      return NextResponse.json({ message: 'Mobile number must be a valid 10-digit number (e.g. 9876543210)' }, { status: 400 });
    }

    const { data: org, error: orgError } = await supabase.from('organizations').select('id').eq('id', id).maybeSingle();
    if (orgError) throw orgError;
    if (!org) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });

    const insertPayload = {
      name,
      email: email || null,
      phone: phone || null,
      role,
      password_hash: bcrypt.hashSync(password, SALT_ROUNDS),
      space_id: spaceId || null,
      org_id: id
    };

    if (permissions && typeof permissions === 'object') {
      insertPayload.permissions = permissions;
    }

    const { data, error } = await supabase
      .from('users')
      .insert(insertPayload)
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
    logger.error('Failed to create organization staff by admin', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
