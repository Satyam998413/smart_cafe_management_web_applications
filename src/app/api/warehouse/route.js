import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/warehouse - Fetch Rooms, Racks, and Boxes with full layout info
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const view = searchParams.get('view') || 'overview'; // 'overview' | 'rooms' | 'racks' | 'boxes'
    const roomId = searchParams.get('roomId');
    const rackId = searchParams.get('rackId');

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    if (view === 'rooms') {
      const { data, error } = await supabase
        .from('warehouse_rooms')
        .select('*')
        .eq('org_id', targetOrgId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (view === 'racks') {
      let query = supabase
        .from('warehouse_racks')
        .select('*, room:warehouse_rooms(name, code), boxes:warehouse_boxes(*, item:inventory_items(name, unit, current_stock), batch:inventory_batches(batch_number, expiry_date))')
        .eq('org_id', targetOrgId);
      
      if (roomId) query = query.eq('room_id', roomId);
      
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (view === 'boxes') {
      let query = supabase
        .from('warehouse_boxes')
        .select('*, item:inventory_items(name, unit), batch:inventory_batches(batch_number, expiry_date), rack:warehouse_racks(name, rack_code)')
        .eq('org_id', targetOrgId);

      if (rackId) query = query.eq('rack_id', rackId);

      const { data, error } = await query.order('box_unique_id', { ascending: true });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Default overview: Rooms + Racks + Boxes + Inventory Items
    const { data: rooms, error: roomsErr } = await supabase
      .from('warehouse_rooms')
      .select('*')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: true });
    if (roomsErr) throw roomsErr;

    const { data: racks, error: racksErr } = await supabase
      .from('warehouse_racks')
      .select('*, room:warehouse_rooms(name, code), boxes:warehouse_boxes(*, item:inventory_items(name, unit), batch:inventory_batches(batch_number, expiry_date))')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: true });
    if (racksErr) throw racksErr;

    const { data: inventoryItems, error: itemErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', targetOrgId)
      .order('name', { ascending: true });
    if (itemErr) throw itemErr;

    return NextResponse.json({
      rooms: rooms || [],
      racks: racks || [],
      inventoryItems: inventoryItems || []
    });
  } catch (error) {
    logger.error('Failed to fetch warehouse data', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}

// POST /api/warehouse - Actions: create_room, create_rack, update_box_item
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { action } = body;
    const targetOrgId = body.org_id || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'org_id required' }, { status: 400 });
    }

    // Action 1: Create Storage Room
    if (action === 'create_room') {
      const { name, code, description, site_id } = body;
      if (!name || !code) {
        return NextResponse.json({ message: 'name and code are required for room' }, { status: 400 });
      }

      const { data: room, error } = await supabase
        .from('warehouse_rooms')
        .insert({
          org_id: targetOrgId,
          site_id: site_id || null,
          name,
          code: code.toUpperCase(),
          description: description || ''
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json(room, { status: 201 });
    }

    // Action 2: Create Rack and auto-populate Box Grid Slots with unique IDs
    if (action === 'create_rack') {
      const { room_id, rack_code, name, total_rows = 4, total_cols = 4 } = body;
      if (!room_id || !rack_code || !name) {
        return NextResponse.json({ message: 'room_id, rack_code, and name required' }, { status: 400 });
      }

      const cleanCode = rack_code.toUpperCase().replace(/\s+/g, '-');

      // 1. Insert Rack
      const colNames = Array.from({ length: total_cols }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
      const rowNumbers = Array.from({ length: total_rows }, (_, i) => `${i + 1}`); // 1, 2, 3...

      const { data: rack, error: rackErr } = await supabase
        .from('warehouse_racks')
        .insert({
          org_id: targetOrgId,
          room_id,
          rack_code: cleanCode,
          name,
          total_rows: parseInt(total_rows),
          total_cols: parseInt(total_cols),
          row_labels: rowNumbers,
          col_labels: colNames
        })
        .select('*')
        .single();

      if (rackErr) throw rackErr;

      // 2. Generate Box slots for each Grid position (Row x Col)
      const boxesToInsert = [];
      for (let r = 1; r <= total_rows; r++) {
        for (let c = 1; c <= total_cols; c++) {
          const colLabel = colNames[c - 1] || `C${c}`;
          const rowLabel = `${r}`;
          const boxUniqueId = `BOX-${cleanCode}-${rowLabel}${colLabel}`;

          boxesToInsert.push({
            org_id: targetOrgId,
            rack_id: rack.id,
            box_unique_id: boxUniqueId,
            row_index: r,
            col_index: c,
            row_label: rowLabel,
            col_label: colLabel,
            current_quantity: 0,
            unit: 'counts',
            status_color: 'gray' // gray = empty
          });
        }
      }

      const { data: insertedBoxes, error: boxErr } = await supabase
        .from('warehouse_boxes')
        .insert(boxesToInsert)
        .select('*');

      if (boxErr) throw boxErr;

      return NextResponse.json({ ...rack, boxes: insertedBoxes }, { status: 201 });
    }

    // Action 3: Assign / Update Item in Box (Sets quantity, unit, item_id, batch_id & status_color)
    if (action === 'update_box_item') {
      const { box_id, item_id, batch_id, current_quantity, unit = 'counts' } = body;
      if (!box_id) {
        return NextResponse.json({ message: 'box_id required' }, { status: 400 });
      }

      const qty = parseFloat(current_quantity || 0);
      let color = 'gray';

      if (qty > 0) {
        color = 'green';
        // Check batch expiry if batch_id provided
        if (batch_id) {
          const { data: batch } = await supabase.from('inventory_batches').select('expiry_date').eq('id', batch_id).single();
          if (batch && batch.expiry_date) {
            const exp = new Date(batch.expiry_date);
            const today = new Date();
            const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              color = 'orange'; // Warning: expiring soon or expired
            }
          }
        }
      }

      const { data: updatedBox, error } = await supabase
        .from('warehouse_boxes')
        .update({
          item_id: qty > 0 ? (item_id || null) : null,
          batch_id: qty > 0 ? (batch_id || null) : null,
          current_quantity: qty,
          unit: unit || 'counts',
          status_color: color,
          updated_at: new Date().toISOString()
        })
        .eq('id', box_id)
        .select('*, item:inventory_items(name, unit), batch:inventory_batches(batch_number, expiry_date)')
        .single();

      if (error) throw error;
      return NextResponse.json(updatedBox);
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Failed to execute warehouse action', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}
