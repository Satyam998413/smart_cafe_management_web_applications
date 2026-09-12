import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { ORDER_SELECT } from '@/lib/orderHelpers.js';

const DELIVERY_STATUSES = ['unassigned', 'assigned', 'picked_up', 'delivered'];

// PATCH /api/orders/[orderId]/delivery — ported from orderController.js's
// updateDeliveryStatus. Owner or Manager. Assign/reassign a rider and/or
// move a delivery order through its own status track (plan Phase 3b). Kept
// separate from the /status route (the order.status enum) since a delivery
// order's fulfillment progress and its kitchen-side status are two
// independent tracks — an order can be "ready" in the kitchen while still
// "assigned" (rider hasn't picked it up yet).
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'owner', 'manager');
  if (roleError) return roleError;

  try {
    const { orderId } = await params;
    const { riderId, deliveryStatus } = await request.json();
    if (riderId === undefined && deliveryStatus === undefined) {
      return NextResponse.json({ message: 'riderId and/or deliveryStatus is required' }, { status: 400 });
    }
    if (deliveryStatus !== undefined && !DELIVERY_STATUSES.includes(deliveryStatus)) {
      return NextResponse.json(
        { message: `deliveryStatus must be one of: ${DELIVERY_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const updates = {};
    if (riderId !== undefined) updates.assigned_rider_id = riderId;
    if (deliveryStatus !== undefined) updates.delivery_status = deliveryStatus;
    // Assigning a rider with no explicit status move implicitly advances
    // unassigned -> assigned — the natural "I picked a rider" action.
    if (riderId && deliveryStatus === undefined) updates.delivery_status = 'assigned';

    const { data, error } = await scopeToOrg(
      supabase.from('orders').update(updates).eq('id', orderId).eq('order_type', 'delivery'),
      auth.orgId
    )
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'Delivery order not found' }, { status: 404 });
    }

    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .single();
    if (fetchError) throw fetchError;

    return NextResponse.json({ message: 'Delivery updated', order: serializeOrder(fullOrder) });
  } catch (error) {
    logger.error('Failed to update delivery status', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
