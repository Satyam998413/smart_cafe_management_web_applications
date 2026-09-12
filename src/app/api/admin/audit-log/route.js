import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeAuditLogEntry } from '@/lib/serializers.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/audit-log — the read side of src/lib/auditLog.js's
// write-only logAudit() (plan Phase 1e). Every mutating admin route in
// this app already logs here; this is the first place any of it is
// actually readable. Filterable by orgId/action/actorId (the same columns
// auditLog.js writes), paginated the same way /api/orders/history is.
// Backs three frontend views: the global activity feed (unfiltered), the
// per-org security log (orgId + action=password_reset), and the per-org
// plan-tier history (orgId + action=plan_tier_changed). Master Admin only.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const params = request.nextUrl.searchParams;
    const orgId = params.get('orgId');
    const action = params.get('action');
    const actorId = params.get('actorId');
    const page = parseInt(params.get('page'), 10) || 1;
    const limit = parseInt(params.get('limit'), 10) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);

    if (orgId) query = query.eq('org_id', orgId);
    if (action) query = query.eq('action', action);
    if (actorId) query = query.eq('actor_id', actorId);

    const { data, error, count } = await query;
    if (error) throw error;

    const totalEntries = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalEntries / limit));

    return NextResponse.json({
      entries: data.map(serializeAuditLogEntry),
      totalEntries,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (error) {
    logger.error('Failed to list audit log entries', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
