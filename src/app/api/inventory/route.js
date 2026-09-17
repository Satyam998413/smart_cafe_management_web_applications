import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/inventory (List stock items, batch expiries, BOM recipes)
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const view = searchParams.get('view') || 'items'; // 'items' | 'batches' | 'expiring' | 'recipes'

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    if (view === 'expiring') {
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('*, item:inventory_items(name, unit)')
        .eq('org_id', targetOrgId)
        .lte('expiry_date', sevenDaysFromNow)
        .gt('quantity_remaining', 0)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (view === 'batches') {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('*, item:inventory_items(name, unit)')
        .eq('org_id', targetOrgId)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (view === 'recipes') {
      const { data, error } = await supabase
        .from('menu_item_recipes')
        .select('*, menu_item:menu_items(name), inventory_item:inventory_items(name, unit)')
        .eq('org_id', targetOrgId);

      if (error) throw error;
      return NextResponse.json(data || []);
    }

    // Default: items view
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('org_id', targetOrgId)
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch inventory', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/inventory (Add inventory item or purchase batch)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { action, name, category, unit, current_stock, min_stock_alert, cost_per_unit, item_id, batch_number, quantity, expiry_date, supplier_name } = body;
    const targetOrgId = body.org_id || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'org_id required' }, { status: 400 });
    }

    // Action 1: Add new Inventory Batch (Food Buy)
    if (action === 'add_batch') {
      if (!item_id || !batch_number || quantity === undefined) {
        return NextResponse.json({ message: 'item_id, batch_number, and quantity are required' }, { status: 400 });
      }

      const qty = parseFloat(quantity);

      const { data: batch, error: batchError } = await supabase
        .from('inventory_batches')
        .insert({
          org_id: targetOrgId,
          item_id,
          batch_number,
          quantity_received: qty,
          quantity_remaining: qty,
          purchase_date: new Date().toISOString().split('T')[0],
          expiry_date: expiry_date || null,
          supplier_name: supplier_name || null
        })
        .select('*')
        .single();

      if (batchError) throw batchError;

      // Update current stock level on item
      const { data: item } = await supabase.from('inventory_items').select('current_stock').eq('id', item_id).single();
      const updatedStock = (parseFloat(item?.current_stock || 0) + qty);
      await supabase.from('inventory_items').update({ current_stock: updatedStock }).eq('id', item_id);

      return NextResponse.json(batch, { status: 201 });
    }

    // Action 2: Add new Inventory Master Item
    if (!name || !category) {
      return NextResponse.json({ message: 'name and category are required' }, { status: 400 });
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        org_id: targetOrgId,
        name,
        category,
        unit: unit || 'units',
        current_stock: parseFloat(current_stock || 0),
        min_stock_alert: parseFloat(min_stock_alert || 5),
        cost_per_unit: parseFloat(cost_per_unit || 0)
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    logger.error('Failed to update inventory', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
