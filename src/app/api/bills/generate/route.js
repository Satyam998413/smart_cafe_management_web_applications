import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';

// POST /api/bills/generate — ported from billingController.js's
// generateBill. Aggregates every unbilled order into one bill (vision doc
// §5). Customer-initiated: their own unbilled orders, regardless of which
// space each was placed from. Staff-initiated (Owner/Manager) may pass
// spaceId to bill an entire table/room's orders at once, across whichever
// guest accounts ordered from it.
/**
 * @swagger
 * /api/bills/generate:
 *   post:
 *     tags: [Bills]
 *     summary: Aggregate unbilled orders into a new bill
 *     description: Customer-initiated bills their own unbilled orders. Owner/Manager may pass spaceId to bill an entire table/room, across whichever guest accounts ordered from it. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               spaceId: { type: string, description: 'Owner/Manager only: bill every unbilled order from this space' }
 *     responses:
 *       201:
 *         description: Bill created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Bill' }
 *       400:
 *         description: No unbilled orders found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  // bills.org_id is NOT NULL (every tenant-scoped table in this schema is)
  // — an account with no org on its JWT yet (e.g. a customer who registered
  // without ever scanning a table/room QR) must be rejected here rather
  // than reaching the insert below, which would otherwise fail the
  // NOT NULL constraint and surface as an opaque 500.
  if (!auth.orgId) {
    return NextResponse.json({ message: 'No organization associated with this account' }, { status: 400 });
  }

  try {
    const { spaceId: overrideSpaceId } = await request.json().catch(() => ({}));
    const isStaff = ['owner', 'manager'].includes(auth.userRole);

    let query = supabase.from('orders').select('*').is('bill_id', null).neq('status', 'cancelled');
    query = isStaff && overrideSpaceId ? query.eq('space_id', overrideSpaceId) : query.eq('user_id', auth.userId);
    query = scopeToOrg(query, auth.orgId);

    const { data: orders, error } = await query;
    if (error) throw error;
    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No unbilled orders found' }, { status: 400 });
    }

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    // Assumes billing_mode is consistent across the batch — a mixed batch
    // (rare: would need a company-canteen order and a personal order from
    // the same session) takes the first order's mode; splitting a batch by
    // billing_mode is a real edge case not handled in this pass.
    const billingMode = orders[0].billing_mode || 'guest_paid';
    const spaceId = overrideSpaceId || orders[0].space_id || null;

    // orders carries no site_id of its own (see schema.sql's bills table
    // comment) — derived through space_id -> spaces.site_id when there is one.
    let siteId = null;
    if (spaceId) {
      const { data: space, error: spaceError } = await supabase.from('spaces').select('site_id').eq('id', spaceId).maybeSingle();
      if (spaceError) throw spaceError;
      siteId = space?.site_id ?? null;
    }

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        org_id: auth.orgId,
        site_id: siteId,
        space_id: spaceId,
        customer_id: billingMode === 'company_charged' ? null : auth.userId,
        status: billingMode === 'company_charged' ? 'company_charged' : 'pending',
        total_amount: totalAmount
      })
      .select('*')
      .single();
    if (billError) throw billError;

    const { error: linkError } = await supabase
      .from('orders')
      .update({ bill_id: bill.id })
      .in('id', orders.map((o) => o.id));
    if (linkError) throw linkError;

    return NextResponse.json(serializeBill({ ...bill, orders }), { status: 201 });
  } catch (error) {
    logger.error('Failed to generate bill', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
