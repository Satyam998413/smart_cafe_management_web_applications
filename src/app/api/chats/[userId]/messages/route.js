import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrderMessage } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';
import { notifyUser } from '@/lib/pushNotifications.js';
import { getIo } from '@/lib/socketServer.js';
import { isAuthorizedForThread, currentCookFor } from '@/lib/chatHelpers.js';

const parseDay = (dateStr) => {
  const iso = dateStr ? `${dateStr}T00:00:00.000Z` : `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const start = new Date(iso);
  if (isNaN(start.getTime())) return null;
  return start;
};

// GET /api/chats/[userId]/messages — ported from chatController.js's
// getMessages. One calendar day at a time, oldest first within that day.
// Defaults to today (UTC) when no ?date= is given; the client pages further
// into history by passing the previous day's date — a day-at-a-time cursor,
// not offset pagination. Marks the other party's messages in the returned
// window as read.
export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { userId } = await params;
    const date = request.nextUrl.searchParams.get('date');

    const authorized = await isAuthorizedForThread(userId, auth.userId, auth.userRole);
    if (!authorized) return NextResponse.json({ message: 'Not a participant on this chat' }, { status: 403 });

    const dayStart = parseDay(date);
    if (!dayStart) return NextResponse.json({ message: 'Invalid date' }, { status: 400 });
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data: messages, error } = await supabase
      .from('order_messages')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .order('created_at', { ascending: true });
    if (error) throw error;

    const unreadFromOtherIds = messages
      .filter((m) => m.sender_id !== auth.userId && !m.read_at)
      .map((m) => m.id);
    if (unreadFromOtherIds.length > 0) {
      const { error: readError } = await supabase
        .from('order_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadFromOtherIds);
      if (readError) throw readError;
    }

    return NextResponse.json({
      messages: messages.map(serializeOrderMessage),
      date: dayStart.toISOString().slice(0, 10)
    });
  } catch (error) {
    logger.error('Failed to fetch chat messages', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/chats/[userId]/messages — ported from chatController.js's
// sendMessage. 403 until this customer's thread has ever been unlocked by a
// claim. Emits to the chat room and the recipient's personal room, and
// fires a push notification. When the customer sends, the recipient is
// whichever cook currently handles them; when a cook sends, the recipient
// is just the customer directly.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { userId } = await params;
    const { body } = await request.json();
    if (!body || !body.trim()) {
      return NextResponse.json({ message: 'Message body is required' }, { status: 400 });
    }

    const authorized = await isAuthorizedForThread(userId, auth.userId, auth.userRole);
    if (!authorized) return NextResponse.json({ message: 'Not a participant on this chat' }, { status: 403 });

    let recipientId;
    if (auth.userRole === 'customer') {
      recipientId = await currentCookFor(userId);
      if (!recipientId) {
        return NextResponse.json(
          { message: 'Chat opens once a cook has claimed one of your orders' },
          { status: 403 }
        );
      }
    } else {
      recipientId = userId;
    }

    const { data: saved, error } = await supabase
      .from('order_messages')
      .insert({
        user_id: userId,
        sender_id: auth.userId,
        body: body.trim(),
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) throw error;

    const serialized = serializeOrderMessage(saved);

    if (io) {
      // role-manager included so the manager's read-only chat oversight
      // view can update live too — managers are never the customer/cook
      // recipient, so without this they'd never receive the event at all.
      io.to([`chat-${userId}`, `user-${recipientId}`, 'role-manager']).emit('chat_message', serialized);
    }
    notifyUser(recipientId, {
      title: 'New message',
      body: body.trim().slice(0, 80),
      data: { type: 'chat_message', userId }
    });

    return NextResponse.json({ message: serialized }, { status: 201 });
  } catch (error) {
    logger.error('Failed to send chat message', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
