import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeMenuItem } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth, requireRole, optionalAuth } from '@/lib/auth.js';
import { MENU_ITEM_SELECT, sortMenuItemOptions } from '@/lib/menuHelpers.js';

// GET /api/menu/[id] — ported from menuController.js's getMenuItemById.
// Scoped by the caller's orgId when a JWT is present (see /api/menu's GET
// for why); still public/no-401 for the anonymous case, matching
// menuRoutes.js's `router.get('/:id', ...)`.
export async function GET(request, { params }) {
  try {
    const auth = optionalAuth(request);
    const { id } = await params;
    const { data, error } = await scopeToOrg(
      supabase.from('menu_items').select(MENU_ITEM_SELECT).eq('id', id),
      auth.orgId
    ).maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'Menu item not found' }, { status: 404 });
    }
    return NextResponse.json(serializeMenuItem(sortMenuItemOptions(data)));
  } catch (error) {
    logger.error('Failed to fetch menu item', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/menu/[id] — ported from menuController.js's updateMenuItem.
// Manager only, same as menuRoutes.js's `router.patch('/:id', requireAuth,
// requireRole('manager'), ...)`.
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireRole(auth, 'manager');
  if (roleError) return roleError;

  try {
    const { id } = await params;
    const { name, category, price, description, imageUrl, images, isAvailable } = await request.json();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = parseFloat(price);
    if (description !== undefined) updates.description = description;
    if (images !== undefined && Array.isArray(images)) {
      if (images.length > 5) {
        return NextResponse.json({ message: 'Maximum 5 images allowed per menu item' }, { status: 400 });
      }
      updates.image_url = JSON.stringify(images.slice(0, 5));
    } else if (imageUrl !== undefined) {
      updates.image_url = imageUrl;
    }
    if (isAvailable !== undefined) updates.is_available = isAvailable;

    const { data, error } = await scopeToOrg(supabase.from('menu_items').update(updates).eq('id', id), auth.orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'Menu item not found' }, { status: 404 });
    }
    return NextResponse.json(serializeMenuItem(data));
  } catch (error) {
    logger.error('Failed to update menu item', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
