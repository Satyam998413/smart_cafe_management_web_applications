import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';
import { ALL_ORG_ROLES } from '@/lib/staffHelpers.js';

// GET /api/admin/organizations/[id]/staff — every owner/manager/cook/waiter
// account in one org, for the Master Admin console (a visibility/support
// tool, same spirit as the Wallet and Security Log tabs — Master Admin
// reviews, Owners still manage their own org's staff). Mirrors
// GET /api/admin/organizations/[id]/wallet's auth/scoping shape: scoped by
// the :id route param rather than the caller's own auth.orgId, master admin
// only. Read-only by design — no PATCH here; role/assignment/permission
// changes stay on the tenant-side /api/staff/** routes.
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
