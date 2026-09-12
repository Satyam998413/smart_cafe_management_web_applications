import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { postClaimAutoMessages } from '@/lib/chatHelpers.js';
import { ORDER_SELECT, emitToRooms } from '@/lib/orderHelpers.js';

// PATCH /api/orders/[orderId]/claim — ported from orderController.js's
// claimOrder. Cook only. The WHERE clause (status='pending' AND
// assigned_cook_id IS NULL) is the entire concurrency guard: Postgres row
// locking means a losing racer's UPDATE affects 0 rows once the winner's
// write commits, so exactly one claimant ever succeeds.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'cook');
  if (roleError) return roleError;

  const io = getIo();
  try {
    const { orderId } = await params;

    const { data: updated, error: updateError } = await scopeToOrg(
      supabase
        .from('orders')
        .update({ status: 'preparing', assigned_cook_id: auth.userId })
        .eq('id', orderId)
        .eq('status', 'pending')
        .is('assigned_cook_id', null),
      auth.orgId
    )
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ message: 'Order already claimed or not available' }, { status: 409 });
    }

    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .single();
    if (fetchError) throw fetchError;

    const serialized = serializeOrder(fullOrder);

    emitToRooms(io, ['role-manager', `user-${fullOrder.user_id}`, `user-${auth.userId}`], 'order_update', serialized);

    // Auto-starts the chat: an order-summary message (as the customer, for
    // the cook) and a special-instructions prompt (as the cook, for the
    // customer) — see lib/chatHelpers.js's postClaimAutoMessages.
    await postClaimAutoMessages(io, fullOrder, auth.userId);

    return NextResponse.json({ message: 'Order claimed successfully', order: serialized });
  } catch (error) {
    logger.error('Failed to claim order', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
