import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeBill } from '@/lib/serializers.js';
import { scopeToOrg } from '@/lib/tenantScope.js';
import { requireAuth } from '@/lib/auth.js';
import { getIo } from '@/lib/socketServer.js';
import { emitToRooms } from '@/lib/billingHelpers.js';

// POST /api/bills/[id]/pay/cash — ported from billingController.js's
// payWithCash. No gateway; just records the guest's choice so the Manager
// screen can surface it (this route doesn't mark the bill paid — the
// collect-cash route does, once cash is physically in hand).
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const io = getIo();
  try {
    const { id } = await params;
    const { data: bill, error: fetchError } = await scopeToOrg(supabase.from('bills').select('*').eq('id', id), auth.orgId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'pending') {
      return NextResponse.json({ message: 'This bill is already settled' }, { status: 400 });
    }

    const { data: updated, error } = await supabase.from('bills').update({ payment_method: 'cash' }).eq('id', id).select('*').single();
    if (error) throw error;

    const serialized = serializeBill(updated);
    // No list-pending-cash-bills endpoint exists — the Manager/Owner
    // client instead accumulates pending cash bills live from this event,
    // same "socket push builds an in-memory list" pattern
    // ManagerDashboardScreen already uses for new orders (customers-orders-
    // cafe). Same room convention as collect-cash's own bill_update emit.
    emitToRooms(io, ['role-manager', 'role-owner'], 'bill_update', serialized);

    return NextResponse.json(serialized);
  } catch (error) {
    logger.error('Failed to record cash payment choice', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
