import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeMenuItem } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole } from '@/lib/auth.js';
import { MENU_ITEM_SELECT, sortMenuItemOptions } from '@/lib/menuHelpers.js';

// GET /api/menu — ported from server/src/controllers/menuController.js's
// getMenuItems. Public (no auth) — matches menuRoutes.js's `router.get('/',
// menuController.getMenuItems)`, which never attaches req.orgId either, so
// org scoping is a no-op here today just like on the Express side.
export async function GET(request) {
  try {
    const category = request.nextUrl.searchParams.get('category');
    let query = scopeToOrg(
      supabase.from('menu_items').select(MENU_ITEM_SELECT).order('created_at', { ascending: false }),
      null
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
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { name, category, price, description, imageUrl, isAvailable } = await request.json();
    if (!name || !category || price === undefined) {
      return NextResponse.json({ message: 'Name, category, and price are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name,
        category,
        price: parseFloat(price),
        description,
        image_url: imageUrl,
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
