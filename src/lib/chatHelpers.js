import supabase from './supabaseClient.js';
import logger from './logger.js';
import { serializeOrderMessage } from './serializers.js';
import { notifyUser } from './pushNotifications.js';

// Ported from server/src/controllers/chatController.js — shared chat-domain
// helpers used by the /api/chats route handlers, the Socket.IO server
// (socketServer.js's join-chat-room handler), and the Orders claim route.
// Renamed from chatAuth.js once it grew past pure authorization checks.
//
// Chat is scoped to a customer — one persistent thread per customer, shared
// across every order a cook has ever claimed for them — not to a single
// order. Every `userId` in this file is the CUSTOMER's id, i.e. the thread's
// identity, never an order id.

// Authorization: a customer may only open their own thread. A cook may open
// a customer's thread only if they've claimed at least one of that
// customer's orders — ever, not just currently active, so chat history
// stays reachable after the order completes. A manager is never authorized
// either way, so "managers don't get chat" falls out of this by
// construction with no separate role branch needed.
export const isAuthorizedForThread = async (customerId, callerId, callerRole) => {
  if (callerRole === 'customer') return callerId === customerId;
  if (callerRole === 'cook') {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', customerId)
      .eq('assigned_cook_id', callerId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }
  return false; // manager
};

// A customer's thread only opens once at least one of their orders has
// ever been claimed by a cook.
export const hasEverBeenClaimed = async (customerId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', customerId)
    .not('assigned_cook_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
};

// The cook "currently handling" a customer, for push/socket targeting when
// the customer sends a message — the assigned cook on their most recently
// claimed order.
export const currentCookFor = async (customerId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('assigned_cook_id, order_time')
    .eq('user_id', customerId)
    .not('assigned_cook_id', 'is', null)
    .order('order_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.assigned_cook_id || null;
};

// Called by the /api/orders/[orderId]/claim route right after a successful
// claim. Auto-posts two messages into the customer's thread so the
// conversation "starts itself" the moment a cook picks up the order:
//   1. An order summary, authored as the customer — lands as an unread
//      "here's what I ordered" for the cook, without them needing to leave
//      the chat to look up order details.
//   2. A special-instructions prompt, authored as the cook — lands as an
//      unread question for the customer, inviting a reply.
// Best-effort: logs and swallows its own errors so a hiccup here never
// fails the claim response itself.
export const postClaimAutoMessages = async (io, order, cookId) => {
  try {
    const itemsSummary = (order.items || [])
      .map((item) => `${item.quantity}x ${item.menuItem?.name || 'item'}`)
      .join(', ');
    const shortId = order.id.slice(-6).toUpperCase();
    const total = Number(order.total_amount).toFixed(2);

    const summaryBody = `🧾 Order #${shortId}: ${itemsSummary || 'details unavailable'} — Total $${total}`;
    const promptBody =
      `Got your order #${shortId}, preparing it now! Any special instructions? ` +
      '(e.g. extra hot, no sugar, allergies) 🙂';

    // order_id/user_id come from the order row itself, which already carries
    // org_id (see the orders placeOrder route's org-id stamp).
    const orgFields = order.org_id ? { org_id: order.org_id } : {};
    const { data: inserted, error } = await supabase
      .from('order_messages')
      .insert([
        { user_id: order.user_id, sender_id: order.user_id, order_id: order.id, body: summaryBody, ...orgFields },
        { user_id: order.user_id, sender_id: cookId, order_id: order.id, body: promptBody, ...orgFields }
      ])
      .select('*');
    if (error) throw error;

    if (io) {
      for (const m of inserted) {
        io.to([`chat-${order.user_id}`, `user-${order.user_id}`, `user-${cookId}`, 'role-manager']).emit(
          'chat_message',
          serializeOrderMessage(m)
        );
      }
    }

    notifyUser(order.user_id, {
      title: 'Your order is being prepared',
      body: promptBody.slice(0, 80),
      data: { type: 'chat_message', userId: order.user_id }
    });
  } catch (error) {
    logger.error('Failed to post claim auto-messages', { error: error.message, orderId: order?.id });
  }
};
