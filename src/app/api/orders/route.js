import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder, serializeNotification } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';
import { notifyRole } from '@/lib/pushNotifications.js';
import { getIo } from '@/lib/socketServer.js';
import { ORDER_SELECT, emitToRooms } from '@/lib/orderHelpers.js';
import { checkBalanceThresholdNotification } from '@/lib/walletService.js';

// POST /api/orders — ported from orderController.js's placeOrder.
// Validation + the multi-row insert (order + order_items) happen atomically
// inside the `place_order` Postgres function, since the Supabase JS client
// has no client-side transaction API.
/**
 * @swagger
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place a new order
 *     description: Debits one coin from the caller organization wallet (when it has one) and notifies cooks over the socket/push channels. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [menuItemId, quantity]
 *                   properties:
 *                     menuItemId: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *                     selectedOptions:
 *                       type: array
 *                       items: { type: object }
 *               mealType: { type: string, enum: [breakfast, lunch, dinner, snack], description: 'Defaults from the current time of day when omitted' }
 *               orderType: { type: string, enum: [pickup, dine_in, delivery], default: pickup }
 *               tableNumber: { type: string, description: 'Required for dine_in when the caller has no QR-scanned space session' }
 *               deliveryAddress: { type: string, description: 'Required for delivery' }
 *               deliveryLat: { type: number }
 *               deliveryLng: { type: number }
 *               deliveryPincode: { type: string }
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 order: { $ref: '#/components/schemas/Order' }
 *       400:
 *         description: Missing/invalid items, orderType, tableNumber, or deliveryAddress
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       402:
 *         description: The organization wallet has no coins left
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const {
      items,
      mealType,
      // A customer who scanned a QR is already sitting at a real space
      // (auth.spaceId, set at login — plan Phase 3a); defaulting orderType
      // to dine_in for them is what "no re-selection" actually means.
      // Anyone else keeps the original pickup default.
      orderType = auth.spaceId ? 'dine_in' : 'pickup',
      tableNumber,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryPincode
    } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Items array is required' }, { status: 400 });
    }
    for (const item of items) {
      if (!item.menuItemId || item.quantity === undefined) {
        return NextResponse.json({ message: 'Each item requires menuItemId and quantity' }, { status: 400 });
      }
    }

    if (!['pickup', 'dine_in', 'delivery'].includes(orderType)) {
      return NextResponse.json({ message: 'orderType must be pickup, dine_in, or delivery' }, { status: 400 });
    }
    // A QR-scanned space already answers "where are you" — only fall back to
    // requiring a typed tableNumber when there's no space session at all.
    if (orderType === 'dine_in' && !tableNumber && !auth.spaceId) {
      return NextResponse.json({ message: 'Table number is required for dine-in orders' }, { status: 400 });
    }
    if (orderType === 'delivery' && !deliveryAddress) {
      return NextResponse.json({ message: 'Delivery address is required for delivery orders' }, { status: 400 });
    }

    let finalMealType = mealType;
    if (!finalMealType) {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 11) finalMealType = 'breakfast';
      else if (hour >= 11 && hour < 16) finalMealType = 'lunch';
      else if (hour >= 16 && hour < 22) finalMealType = 'dinner';
      else finalMealType = 'snack';
    }

    const { data: orderId, error: rpcError } = await supabase.rpc('place_order', {
      p_user_id: auth.userId,
      p_meal_type: finalMealType,
      p_items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || []
      })),
      p_order_type: orderType,
      p_table_number: orderType === 'dine_in' ? tableNumber : null,
      p_delivery_address: orderType === 'delivery' ? deliveryAddress : null,
      p_delivery_lat: orderType === 'delivery' ? deliveryLat ?? null : null,
      p_delivery_lng: orderType === 'delivery' ? deliveryLng ?? null : null,
      p_delivery_pincode: orderType === 'delivery' ? deliveryPincode ?? null : null
    });

    if (rpcError) {
      // P0001 = RAISE EXCEPTION inside place_order (business-rule validation failure)
      if (rpcError.code === 'P0001') {
        return NextResponse.json({ message: rpcError.message }, { status: 400 });
      }
      throw rpcError;
    }

    // place_order() predates org_id/space_id (Phases 0/3a) and doesn't set
    // them itself; stamp them on the row it just created. A no-op until
    // auth.orgId exists (see lib/tenantScope.js) — safe to ship ahead of the
    // tenant-#1 migration. space_id only applies to the dine_in/QR path — a
    // pickup or delivery order has nowhere to sit and stays null.
    if (auth.orgId || (auth.spaceId && orderType === 'dine_in')) {
      const stamp = {
        ...(auth.orgId ? { org_id: auth.orgId } : {}),
        ...(auth.spaceId && orderType === 'dine_in' ? { space_id: auth.spaceId } : {})
      };
      const { error: stampError } = await supabase.from('orders').update(stamp).eq('id', orderId);
      if (stampError) throw stampError;
    }

    // Coin debit (plan Phase 1B.b): 1 coin per order, taken from the org's
    // wallet. decrement_wallet_balance() is its own atomic conditional
    // UPDATE (see schema.sql), so this can't race with a concurrent order
    // draining the same wallet to zero. If it raises (empty wallet), the
    // order this request just created is deleted as a compensating action —
    // there's no shared transaction between this RPC and place_order()
    // above, so "order exists" and "coin was charged" have to be kept in
    // sync by hand rather than atomically together.
    if (auth.orgId) {
      const { error: debitError } = await supabase.rpc('decrement_wallet_balance', {
        p_org_id: auth.orgId,
        p_amount: 1,
        p_order_id: orderId
      });
      if (debitError) {
        await supabase.from('orders').delete().eq('id', orderId);
        return NextResponse.json(
          { message: 'This organization has no coins left. Ask an Owner or Manager to recharge.' },
          { status: 402 }
        );
      }

      // Balance-threshold notification (plan Phase 1B.b) — best-effort: a
      // failure here shouldn't fail an order that already succeeded and was
      // already paid for.
      try {
        const notification = await checkBalanceThresholdNotification({ orgId: auth.orgId, amount: 1 });
        if (notification) {
          emitToRooms(io, [`role-${notification.target_role}`], 'notification', serializeNotification(notification));
        }
      } catch (notifyError) {
        logger.error('Failed to check/create balance threshold notification', { error: notifyError.message });
      }
    }

    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .single();
    if (fetchError) throw fetchError;

    const serialized = serializeOrder(fullOrder);

    // Queue alert: every new order needs a cook to claim it.
    emitToRooms(io, ['role-manager', 'role-cook'], 'customers-orders-cafe', serialized);
    notifyRole('cook', {
      title: 'New order needs a cook',
      body: `Order #${orderId.slice(-6).toUpperCase()} is waiting to be claimed`,
      data: { type: 'new_order', orderId }
    });

    return NextResponse.json({ message: 'Order placed successfully', order: serialized }, { status: 201 });
  } catch (error) {
    logger.error('Failed to place order', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
