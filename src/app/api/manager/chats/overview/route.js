import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';

// GET /api/manager/chats/overview — ported from managerChatController.js's
// getChatOverview. Manager only. Read-only oversight — deliberately does
// NOT reuse the customer-facing chats/[userId]/messages GET route, since
// that marks the other party's messages as read keyed off the caller's id.
// A manager "viewing" a conversation must never mutate read_at on behalf of
// the real participants.
//
// Every customer<->cook pairing that has exchanged at least one message,
// flattened into one row per pairing so the client can group it two ways
// (by cook, by user).
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { data: messages, error } = await scopeToOrg(
      supabase.from('order_messages').select('user_id, sender_id, body, created_at').order('created_at', { ascending: false }),
      auth.orgId
    );
    if (error) throw error;

    if (!messages || messages.length === 0) {
      return NextResponse.json([]);
    }

    const involvedIds = new Set();
    for (const m of messages) {
      if (m.user_id) involvedIds.add(m.user_id);
      if (m.sender_id) involvedIds.add(m.sender_id);
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, role')
      .in('id', Array.from(involvedIds));
    if (usersError) throw usersError;

    const userById = new Map(users.map((u) => [u.id, u]));

    // Group by customer thread (user_id), tracking each distinct cook sender
    // seen in that thread plus the thread's most recent message.
    const threadsByUser = new Map();
    for (const m of messages) {
      if (!m.user_id) continue;
      let thread = threadsByUser.get(m.user_id);
      if (!thread) {
        thread = { lastMessage: m.body, lastMessageAt: m.created_at, messageCount: 0, cookIds: new Set() };
        threadsByUser.set(m.user_id, thread);
      }
      thread.messageCount += 1;
      const sender = userById.get(m.sender_id);
      if (sender && sender.role === 'cook') {
        thread.cookIds.add(sender.id);
      }
    }

    const overview = [];
    for (const [userId, thread] of threadsByUser.entries()) {
      const customer = userById.get(userId);
      if (!customer) continue;
      const cookIds = thread.cookIds.size > 0 ? Array.from(thread.cookIds) : [null];
      for (const cookId of cookIds) {
        const cook = cookId ? userById.get(cookId) : null;
        overview.push({
          userId,
          userName: customer.name,
          cookId: cookId || null,
          cookName: cook ? cook.name : null,
          lastMessage: thread.lastMessage,
          lastMessageAt: thread.lastMessageAt,
          messageCount: thread.messageCount
        });
      }
    }

    overview.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    return NextResponse.json(overview);
  } catch (error) {
    logger.error('Failed to load manager chat overview', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
