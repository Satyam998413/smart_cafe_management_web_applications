import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeUser, serializeOrderMessage } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';
import { hasEverBeenClaimed, currentCookFor } from '@/lib/chatHelpers.js';

// GET /api/chats/threads — ported from chatController.js's getThreads.
// One persistent thread per customer, not per order. A customer gets at
// most one thread (their own, if ever claimed); a cook gets one row per
// distinct customer they've ever claimed an order for — bounded by the
// cafe's total customer count. Manager always gets an empty list.
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    if (auth.userRole === 'manager') return NextResponse.json({ threads: [] });

    let customerIds;
    if (auth.userRole === 'customer') {
      customerIds = (await hasEverBeenClaimed(auth.userId)) ? [auth.userId] : [];
    } else {
      const { data, error } = await supabase.from('orders').select('user_id').eq('assigned_cook_id', auth.userId);
      if (error) throw error;
      customerIds = [...new Set(data.map((o) => o.user_id))];
    }

    if (customerIds.length === 0) return NextResponse.json({ threads: [] });

    const { data: customers, error: customersError } = await supabase
      .from('users')
      .select('*')
      .in('id', customerIds);
    if (customersError) throw customersError;

    // A customer's own "other party" is whichever cook is currently
    // handling them — irrelevant for a cook's own list, where the other
    // party is just the customer on each row.
    let currentCookId = null;
    let currentCook = null;
    if (auth.userRole === 'customer') {
      currentCookId = await currentCookFor(auth.userId);
      if (currentCookId) {
        const { data } = await supabase.from('users').select('*').eq('id', currentCookId).maybeSingle();
        currentCook = data;
      }
    }

    const { data: messages, error: messagesError } = await supabase
      .from('order_messages')
      .select('*')
      .in('user_id', customerIds)
      .order('created_at', { ascending: true });
    if (messagesError) throw messagesError;

    const threads = customerIds.map((customerId) => {
      const threadMessages = messages.filter((m) => m.user_id === customerId);
      const lastMessage = threadMessages[threadMessages.length - 1] || null;
      const unreadCount = threadMessages.filter((m) => m.sender_id !== auth.userId && !m.read_at).length;
      const otherParty = auth.userRole === 'cook' ? customers.find((c) => c.id === customerId) : currentCook;

      return {
        userId: customerId,
        otherParty: serializeUser(otherParty),
        lastMessage: serializeOrderMessage(lastMessage),
        unreadCount
      };
    });

    threads.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || ''));

    return NextResponse.json({ threads });
  } catch (error) {
    logger.error('Failed to fetch chat threads', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
