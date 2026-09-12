import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrganization } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/organizations/me — any authenticated staff/customer's own org
// profile + branding theme (plan Phase 1d/2). Unlike /api/admin/organizations/*
// (master_admin only, cross-tenant), this is the org-scoped counterpart:
// an Owner/Manager/Cook/Waiter/Customer reads their *own* org, resolved from
// the orgId already stamped on their JWT — no id param, nothing to leak
// across tenants. master_admin's own JWT carries orgId = null (platform-
// level, not tenant-scoped), so it 404s here rather than resolving anything.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  if (!auth.orgId) {
    return NextResponse.json({ message: 'No organization associated with this account' }, { status: 404 });
  }

  try {
    const { data, error } = await supabase.from('organizations').select('*').eq('id', auth.orgId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: 'Organization not found' }, { status: 404 });
    return NextResponse.json(serializeOrganization(data));
  } catch (error) {
    logger.error('Failed to fetch own organization profile', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
