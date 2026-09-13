import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeNotification } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';
import { scopeToOrg } from '@/lib/tenantScope.js';

// GET /api/notifications — the current user's role-/user-targeted
// notifications for their own org (plan Phase 1B; today's only producer is
// src/lib/walletService.js's checkBalanceThresholdNotification, called from
// the order-placement wallet debit). A row is visible to a caller when its
// org_id matches theirs AND (its target_role matches their role OR its
// target_user_id matches their own id).
//
// This isn't a high-volume feed (at most one row per balance-threshold
// crossing), so pagination stays minimal: `unreadOnly` (default true) and
// an optional `limit` (default 20, capped at 100) are the only knobs.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    // No org yet (pre-migration caller) means nothing to show — same
    // "normal, expected state" reasoning as GET /api/wallet.
    if (!auth.orgId) {
      return NextResponse.json({ notifications: [] });
    }

    const params = request.nextUrl.searchParams;
    const unreadOnly = params.get('unreadOnly') !== 'false';
    const limit = Math.min(parseInt(params.get('limit'), 10) || 20, 100);

    let query = scopeToOrg(
      supabase
        .from('notifications')
        .select('*')
        .or(`target_role.eq.${auth.userRole},target_user_id.eq.${auth.userId}`)
        .order('created_at', { ascending: false })
        .limit(limit),
      auth.orgId
    );
    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ notifications: (data || []).map(serializeNotification) });
  } catch (error) {
    logger.error('Failed to fetch notifications', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
