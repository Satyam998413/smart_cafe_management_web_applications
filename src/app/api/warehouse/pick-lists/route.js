import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/warehouse/pick-lists
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const cookId = searchParams.get('cookId');
    const pickListId = searchParams.get('id');

    if (pickListId) {
      const { data: pickList, error } = await supabase
        .from('kitchen_pick_lists')
        .select(`
          *,
          assigned_cook:users!kitchen_pick_lists_assigned_cook_id_fkey(id, full_name, email),
          items:kitchen_pick_list_items(
            *,
            item:inventory_items(name, unit),
            box:warehouse_boxes(box_unique_id, row_label, col_label, rack_id),
            rack:warehouse_racks(name, rack_code)
          )
        `)
        .eq('id', pickListId)
        .single();

      if (error) throw error;
      return NextResponse.json(pickList);
    }

    let query = supabase
      .from('kitchen_pick_lists')
      .select(`
        *,
        assigned_cook:users!kitchen_pick_lists_assigned_cook_id_fkey(id, full_name, email),
        items:kitchen_pick_list_items(
          *,
          item:inventory_items(name, unit),
          box:warehouse_boxes(box_unique_id, row_label, col_label)
        )
      `)
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (cookId) {
      query = query.eq('assigned_cook_id', cookId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch pick lists', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}

// POST /api/warehouse/pick-lists - Create Pick List and assign to Cook
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { assigned_cook_id, items, notes } = body;
    const targetOrgId = body.org_id || auth.orgId;

    if (!targetOrgId || !items || !items.length) {
      return NextResponse.json({ message: 'org_id and items are required' }, { status: 400 });
    }

    const pickListNumber = `PL-${Date.now().toString().slice(-6)}`;
    const qrCodeToken = `QR-PL-${targetOrgId.slice(0, 4)}-${pickListNumber}`;

    // 1. Insert master pick list
    const { data: pickList, error: listErr } = await supabase
      .from('kitchen_pick_lists')
      .insert({
        org_id: targetOrgId,
        pick_list_number: pickListNumber,
        assigned_cook_id: assigned_cook_id || null,
        created_by: auth.userId,
        status: 'pending',
        qr_code_token: qrCodeToken,
        notes: notes || ''
      })
      .select('*')
      .single();

    if (listErr) throw listErr;

    // 2. Insert items
    const pickItemsToInsert = items.map((item) => ({
      pick_list_id: pickList.id,
      item_id: item.item_id,
      box_id: item.box_id || null,
      rack_id: item.rack_id || null,
      required_quantity: parseFloat(item.required_quantity || 1),
      picked_quantity: 0,
      unit: item.unit || 'counts',
      status: 'pending'
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('kitchen_pick_list_items')
      .insert(pickItemsToInsert)
      .select('*');

    if (itemsErr) throw itemsErr;

    return NextResponse.json({ ...pickList, items: insertedItems }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create pick list', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}

// PATCH /api/warehouse/pick-lists - Cook updates item scan & quantity
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { pick_list_id, item_id, scanned_box_qr, picked_quantity, is_dropoff } = body;

    if (!pick_list_id || !item_id) {
      return NextResponse.json({ message: 'pick_list_id and item_id are required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const updatePayload = {
      scanned_box_qr: scanned_box_qr || null,
      picked_quantity: parseFloat(picked_quantity || 0),
      status: parseFloat(picked_quantity) >= 0 ? 'picked' : 'pending'
    };

    if (is_dropoff) {
      updatePayload.drop_timestamp = nowIso;
    } else {
      updatePayload.pickup_timestamp = nowIso;
    }

    const { data: updatedItem, error } = await supabase
      .from('kitchen_pick_list_items')
      .update(updatePayload)
      .eq('pick_list_id', pick_list_id)
      .eq('id', item_id)
      .select('*')
      .single();

    if (error) throw error;

    // Update parent pick list timestamps & status
    const { data: allItems } = await supabase
      .from('kitchen_pick_list_items')
      .select('status')
      .eq('pick_list_id', pick_list_id);

    const allPicked = allItems && allItems.every((i) => i.status === 'picked');
    const newStatus = allPicked ? 'completed' : 'in_progress';

    const parentPayload = { status: newStatus };
    if (is_dropoff) {
      parentPayload.drop_time = nowIso;
    } else {
      parentPayload.pickup_time = nowIso;
    }

    await supabase
      .from('kitchen_pick_lists')
      .update(parentPayload)
      .eq('id', pick_list_id);

    return NextResponse.json(updatedItem);
  } catch (error) {
    logger.error('Failed to update pick list item', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}
