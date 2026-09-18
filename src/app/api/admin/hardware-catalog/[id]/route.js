import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeHardwareItem } from '@/lib/serializers.js';

// GET /api/admin/hardware-catalog/[id] — Fetch single item details
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Item ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('hardware_catalog')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: 'Hardware item not found' }, { status: 404 });
    }

    return NextResponse.json(serializeHardwareItem(data));
  } catch (error) {
    logger.error('Failed to fetch hardware item details', { error: error.message });
    return NextResponse.json({ message: 'Server error fetching hardware details' }, { status: 500 });
  }
}

// PATCH /api/admin/hardware-catalog/[id] — Update single hardware item details
export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'technician'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Item ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, category, model_number, description, unit_price, stock_quantity, specifications, image_url, images } = body;

    let updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (model_number !== undefined) updateData.model_number = model_number;
    if (description !== undefined) updateData.description = description;
    if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price);
    if (stock_quantity !== undefined) updateData.stock_quantity = parseInt(stock_quantity, 10);
    if (specifications !== undefined) updateData.specifications = specifications;

    if (Array.isArray(images) && images.length > 0) {
      updateData.image_url = JSON.stringify(images.slice(0, 5));
    } else if (image_url !== undefined) {
      updateData.image_url = image_url;
    }

    const { data, error } = await supabase
      .from('hardware_catalog')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Updated hardware catalog item', { id, name: data.name });
    return NextResponse.json(serializeHardwareItem(data));
  } catch (error) {
    logger.error('Failed to update hardware item', { error: error.message });
    return NextResponse.json({ message: 'Server error updating item' }, { status: 500 });
  }
}

// DELETE /api/admin/hardware-catalog/[id] — Delete hardware item
export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'technician'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'Item ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('hardware_catalog')
      .delete()
      .eq('id', id);

    if (error) throw error;

    logger.info('Deleted hardware item', { id });
    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete hardware item', { error: error.message });
    return NextResponse.json({ message: 'Server error deleting hardware item' }, { status: 500 });
  }
}
