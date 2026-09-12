import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/bills/company-statement — ported from billingController.js's
// getCompanyStatement. Owner or Manager. A read-only report for now, not a
// stored bills row: company-charged billing (vision doc §9) is meant to be
// "generated periodically," which needs a scheduler this codebase doesn't
// have yet (Phase 5/accounting-export territory). This gives Owner/Manager
// the same numbers on demand in the meantime.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const params = request.nextUrl.searchParams;
    const fromDate = params.get('fromDate');
    const toDate = params.get('toDate');

    let query = supabase.from('orders').select('*, user:users!user_id(*)').eq('billing_mode', 'company_charged');
    query = scopeToOrg(query, auth.orgId);
    if (fromDate) query = query.gte('order_time', new Date(fromDate).toISOString());
    if (toDate) query = query.lte('order_time', new Date(toDate).toISOString());

    const { data, error } = await query;
    if (error) throw error;

    const totalAmount = data.reduce((sum, o) => sum + Number(o.total_amount), 0);
    return NextResponse.json({ orderCount: data.length, totalAmount, orders: data.map(serializeOrder) });
  } catch (error) {
    logger.error('Failed to generate company statement', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
