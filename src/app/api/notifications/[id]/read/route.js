import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeNotification } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';

// PATCH /api/notifications/[id]/read — marks one notification read. Scoped
// so a caller can only touch their own org's notifications, and only ones
// actually targeted at them (their role or their own user id) — not just
// any row that happens to share their org, since e.g. a Manager shouldn't
// be able to silence an Owner-targeted zero-balance alert. A notification
// outside that scope (wrong org, or org-mate but not targeted at this
// caller) 404s exactly like "not found", the same non-leaking shape
// coin-purchases/[id]/cancel uses for a purchase outside the caller's org.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    if (!auth.orgId) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    const { data: updated, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('org_id', auth.orgId)
      .or(`target_role.eq.${auth.userRole},target_user_id.eq.${auth.userId}`)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(serializeNotification(updated));
  } catch (error) {
    logger.error('Failed to mark notification read', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
