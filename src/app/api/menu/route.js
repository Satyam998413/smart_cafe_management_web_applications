import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeMenuItem } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole, optionalAuth } from '@/lib/auth.js';
import { MENU_ITEM_SELECT, sortMenuItemOptions } from '@/lib/menuHelpers.js';

// GET /api/menu — ported from server/src/controllers/menuController.js's
// getMenuItems, but no longer a tenant-blind no-op: every caller in this app
// (staff dashboard, customer app) already sends a JWT with an orgId claim by
// the time they browse the menu, so scope by it when present. Stays public
// (no 401) for the no-token case since there's no anonymous public menu page
// yet — that will need an explicit orgId/spaceId resolver once one exists.
/**
 * @swagger
 * /api/menu:
 *   get:
 *     tags: [Menu]
 *     summary: List menu items
 *     description: Scoped to the caller organization when a valid bearer token is present. Public (no 401) when no token is sent - there is no per-organization anonymous menu page yet.
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Menu items, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/MenuItem' }
 */
export async function GET(request) {
  try {
    const auth = optionalAuth(request);
    const category = request.nextUrl.searchParams.get('category');
    let query = scopeToOrg(
      supabase.from('menu_items').select(MENU_ITEM_SELECT).order('created_at', { ascending: false }),
      auth.orgId
    );
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data.map(sortMenuItemOptions).map(serializeMenuItem));
  } catch (error) {
    logger.error('Failed to list menu items', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/menu — ported from menuController.js's createMenuItem. Manager
// only — mutations were previously callable by anyone (no auth at all), now
// gated same as menuRoutes.js's `router.post('/', requireAuth,
// requireRole('manager'), ...)`.
/**
 * @swagger
 * /api/menu:
 *   post:
 *     tags: [Menu]
 *     summary: Create a menu item
 *     description: Manager only. Requires a bearer token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price]
 *             properties:
 *               name: { type: string }
 *               category: { type: string }
 *               price: { type: number }
 *               description: { type: string }
 *               imageUrl: { type: string }
 *               isAvailable: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Menu item created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MenuItem' }
 *       400:
 *         description: Missing name, category, or price
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       403:
 *         description: Caller is not a Manager
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { name, category, price, description, imageUrl, images, isAvailable } = await request.json();
    if (!name || !category || price === undefined) {
      return NextResponse.json({ message: 'Name, category, and price are required' }, { status: 400 });
    }
    let finalImageUrl = imageUrl || '';
    if (Array.isArray(images) && images.length > 0) {
      if (images.length > 5) {
        return NextResponse.json({ message: 'Maximum 5 images allowed per menu item' }, { status: 400 });
      }
      finalImageUrl = JSON.stringify(images.slice(0, 5));
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name,
        category,
        price: parseFloat(price),
        description,
        image_url: finalImageUrl,
        is_available: isAvailable !== undefined ? isAvailable : true,
        ...(auth.orgId ? { org_id: auth.orgId } : {})
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json(serializeMenuItem(data), { status: 201 });
  } catch (error) {
    logger.error('Failed to create menu item', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
