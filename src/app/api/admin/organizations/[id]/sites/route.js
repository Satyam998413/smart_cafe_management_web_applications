import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeSite } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/organizations/[id]/sites — read-only visibility into a
// tenant's sites for Master Admin, mirroring the Staff/Wallet tabs'
// "support tool, not a duplicate management surface" pattern. Org scoped
// by the URL param, not auth.orgId (master_admin's own orgId is null).
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { data, error } = await supabase.from('sites').select('*').eq('org_id', id).order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json(data.map(serializeSite));
  } catch (error) {
    logger.error('Failed to list organization sites (admin)', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
