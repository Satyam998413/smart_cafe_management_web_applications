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
