import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { notifyUser } from '@/lib/pushNotifications.js';
import { getIo } from '@/lib/socketServer.js';
import { ORDER_SELECT, emitToRooms } from '@/lib/orderHelpers.js';

// PATCH /api/orders/[orderId]/status — ported from orderController.js's
// updateOrderStatus, plus a Waiter branch (flutter-app-master-plan.md's
// Waiter role — delivery queue, no schema change): a waiter may only move a
// 'ready' order to 'completed' (marking it delivered to the table), with no
// per-waiter ownership/claiming — any waiter can complete any ready order,
// gated by the .eq('status', 'ready') guard below rather than an
// assigned_*_id column the way cook's claim ownership is. Manager/Owner:
// unrestricted. Customer: forbidden outright.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { orderId } = await params;
    const { status } = await request.json();

    if (auth.userRole === 'customer') {
      return NextResponse.json({ message: 'Not permitted' }, { status: 403 });
    }
    if (!status || !['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ message: 'Valid status is required' }, { status: 400 });
    }
    if (auth.userRole === 'cook' && !['ready', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { message: 'Cooks can only advance to ready, completed, or cancelled' },
        { status: 403 }
      );
    }
    if (auth.userRole === 'waiter' && status !== 'completed') {
      return NextResponse.json({ message: 'Waiters can only mark a ready order as delivered (completed)' }, { status: 403 });
    }

    let updateQuery = scopeToOrg(supabase.from('orders').update({ status }).eq('id', orderId), auth.orgId);
    if (auth.userRole === 'cook') {
      updateQuery = updateQuery.eq('assigned_cook_id', auth.userId);
    } else if (auth.userRole === 'waiter') {
      updateQuery = updateQuery.eq('status', 'ready');
    }

    const { data: updated, error: updateError } = await updateQuery.select('id').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .single();
    if (fetchError) throw fetchError;

    const serialized = serializeOrder(fullOrder);

    emitToRooms(
      io,
      ['role-manager', `user-${fullOrder.user_id}`, fullOrder.assigned_cook_id && `user-${fullOrder.assigned_cook_id}`],
      'order_update',
      serialized
    );

    if (status === 'ready') {
      notifyUser(fullOrder.user_id, {
        title: 'Order ready! 🎉',
        body: `Order #${orderId.slice(-6).toUpperCase()} is ready for pickup`,
        data: { type: 'order_ready', orderId }
      });
    }

    return NextResponse.json({ message: 'Order status updated successfully', order: serialized });
  } catch (error) {
    logger.error('Failed to update order status', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
