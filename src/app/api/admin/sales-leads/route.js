import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, requireMasterAdmin } from '@/lib/auth.js';

// GET /api/admin/sales-leads
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  const roleError = requireMasterAdmin(auth);
  if (roleError) return roleError;

  try {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*, salesman:users!sales_orders_salesman_id_fkey(name, email), technician:users!sales_orders_assigned_technician_id_fkey(name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to list sales leads', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/sales-leads (Assign technician or accept lead setup ticket)
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { orderId, technicianId, ticketStatus } = body;

    if (!orderId) {
      return NextResponse.json({ message: 'orderId is required' }, { status: 400 });
    }

    const updatePayload = {};
    if (technicianId) updatePayload.assigned_technician_id = technicianId;
    if (ticketStatus) updatePayload.ticket_status = ticketStatus;

    const { data, error } = await supabase
      .from('sales_orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*, salesman:users!sales_orders_salesman_id_fkey(name), technician:users!sales_orders_assigned_technician_id_fkey(name)')
      .single();

    if (error) throw error;

    // Send notification to technician
    if (data.assigned_technician_id) {
      await supabase.from('notifications').insert({
        user_id: data.assigned_technician_id,
        title: 'New Hardware Installation Ticket',
        message: `You have been assigned to setup ${data.org_name} (Sales Lead by ${data.salesman?.name}).`,
        type: 'ticket_assignment'
      });
    }

    logger.info('Updated sales lead ticket assignment', { orderId, technicianId, ticketStatus });
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Failed to update sales lead ticket', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
