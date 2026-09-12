import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/manager-cook-chat/overview — ported from
// managerCookChatController.js's getOverview. Manager or Cook. Every
// conversation the caller has, from their own side of the pair, with an
// unread count for badges. Works for both roles: a manager gets one row per
// cook, a cook gets one row per manager.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager', 'cook');
  if (roleError) return roleError;

  try {
    const column = auth.userRole === 'manager' ? 'manager_id' : 'cook_id';
    const otherColumn = column === 'manager_id' ? 'cook_id' : 'manager_id';

    const { data, error } = await supabase
      .from('manager_cook_messages')
      .select('*')
      .eq(column, auth.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const byOther = new Map();
    for (const m of data) {
      const otherUserId = m[otherColumn];
      let entry = byOther.get(otherUserId);
      if (!entry) {
        entry = { otherUserId, lastMessage: m.body, lastMessageAt: m.created_at, unreadCount: 0 };
        byOther.set(otherUserId, entry);
      }
      if (m.sender_id === otherUserId && !m.read_at) entry.unreadCount += 1;
    }

    return NextResponse.json(Array.from(byOther.values()));
  } catch (error) {
    logger.error('Failed to load manager-cook chat overview', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
