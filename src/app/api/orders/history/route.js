import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeOrder } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { ORDER_SELECT } from '@/lib/orderHelpers.js';

// GET /api/orders/history — ported from orderController.js's
// getOrderHistory. Every order route requires a real, role-bearing token
// (orderRoutes.js's `router.use(requireAuth)`) — closes the pre-existing
// IDOR where history was readable with zero/spoofed auth. Scoped by role: a
// customer only ever sees their own orders; a manager sees everything; a
// cook sees the unclaimed queue by default, or their own claims when
// scope=mine.
/**
 * @swagger
 * /api/orders/history:
 *   get:
 *     tags: [Orders]
 *     summary: List orders, scoped by the caller role
 *     description: Customer sees only their own orders; cook sees the unclaimed queue by default or their own claims with scope=mine; waiter sees the ready-for-delivery queue by default; manager/owner see everything. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: mealType
 *         schema: { type: string, enum: [breakfast, lunch, dinner, snack] }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Overrides the role default queue filter
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [mine] }
 *         description: 'Cook only: restrict to orders assigned to the caller'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated order history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 *                 totalPages: { type: integer }
 *                 currentPage: { type: integer }
 *                 totalOrders: { type: integer }
 *                 hasNextPage: { type: boolean }
 *                 hasPrevPage: { type: boolean }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const params = request.nextUrl.searchParams;
    const fromDate = params.get('fromDate');
    const toDate = params.get('toDate');
    const mealType = params.get('mealType');
    const status = params.get('status');
    const scope = params.get('scope');
    const page = params.get('page') || 1;
    const limit = params.get('limit') || 20;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = scopeToOrg(
      supabase
        .from('orders')
        .select(ORDER_SELECT, { count: 'exact' })
        .order('order_time', { ascending: false })
        .range(from, to),
      auth.orgId
    );

    if (auth.userRole === 'customer') {
      query = query.eq('user_id', auth.userId);
    } else if (auth.userRole === 'cook') {
      if (scope === 'mine') {
        query = query.eq('assigned_cook_id', auth.userId);
      } else {
        query = query.eq('status', 'pending').is('assigned_cook_id', null);
      }
    } else if (auth.userRole === 'waiter' && !status) {
      // Waiter's delivery queue: orders ready for pickup-to-table, no
      // per-waiter assignment (flutter-app-master-plan.md's Waiter role —
      // any waiter can see and complete any ready order). An explicit
      // ?status= overrides this default, same escape hatch every other
      // role already has via the generic status filter below (e.g.
      // status=completed to see delivery history).
      query = query.eq('status', 'ready');
    }
    // manager/owner: unrestricted — sees full order history.

    if (fromDate) query = query.gte('order_time', new Date(fromDate).toISOString());
    if (toDate) query = query.lte('order_time', new Date(toDate).toISOString());
    if (mealType) query = query.eq('meal_type', mealType);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    const totalOrders = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limitNum));

    return NextResponse.json({
      orders: data.map(serializeOrder),
      totalPages,
      currentPage: pageNum,
      totalOrders,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });
  } catch (error) {
    logger.error('Failed to fetch order history', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
