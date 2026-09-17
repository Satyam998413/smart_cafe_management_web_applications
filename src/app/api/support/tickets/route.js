import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/support/tickets?orgId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    let query = supabase
      .from('support_tickets')
      .select('*, org:organizations(name), creator:users!support_tickets_created_by_fkey(name, email), technician:users!support_tickets_assigned_technician_id_fkey(name), history:support_ticket_history(*, actor:users(name, role))')
      .order('created_at', { ascending: false });

    // If caller is an Owner/Manager, restrict to their org
    if (auth.userRole === 'owner' || auth.userRole === 'manager') {
      if (!targetOrgId) return NextResponse.json({ message: 'orgId required' }, { status: 400 });
      query = query.eq('org_id', targetOrgId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to list support tickets with history', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/support/tickets (Owner creates support ticket + fires push notification)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { title, category, urgency, device_id, space_id, description } = body;
    const targetOrgId = body.org_id || auth.orgId;

    if (!title || !category || !description || !targetOrgId) {
      return NextResponse.json(
        { message: 'title, category, description, and org_id are required' },
        { status: 400 }
      );
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        org_id: targetOrgId,
        created_by: auth.userId,
        title,
        category,
        urgency: urgency || 'medium',
        device_id: device_id || null,
        space_id: space_id || null,
        description,
        status: 'open'
      })
      .select('*, org:organizations(name)')
      .single();

    if (error) throw error;

    // Record initial history entry
    await supabase.from('support_ticket_history').insert({
      ticket_id: ticket.id,
      actor_id: auth.userId,
      actor_role: auth.userRole,
      previous_status: null,
      new_status: 'open',
      remarks: 'Support ticket created by premise owner.'
    });

    // Fire Notifications to Master Admins & Technicians
    const { data: adminsAndTechs } = await supabase
      .from('users')
      .select('id')
      .in('role', ['master_admin', 'technician']);

    if (adminsAndTechs && adminsAndTechs.length > 0) {
      const notifRows = adminsAndTechs.map((user) => ({
        user_id: user.id,
        title: `New Support Ticket [${urgency?.toUpperCase()}]`,
        message: `${ticket.org?.name}: ${title}`,
        type: 'support_ticket'
      }));
      await supabase.from('notifications').insert(notifRows);
    }

    logger.info('Created new support ticket and recorded initial history', { ticketId: ticket.id, title });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    logger.error('Failed to create support ticket', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/support/tickets (Technician / Master Admin updates status + remarks & records audit history)
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { ticketId, status, action, remarks } = body;
    // Status options: 'open', 'assigned', 'accepted', 'need_visiting', 'visited_pending', 'in_progress', 'resolved', 'closed'

    if (!ticketId) {
      return NextResponse.json({ message: 'ticketId is required' }, { status: 400 });
    }

    // 1. Fetch current ticket to capture previous_status
    const { data: currentTicket, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('status, assigned_technician_id, title, created_by')
      .eq('id', ticketId)
      .single();

    if (fetchErr) throw fetchErr;

    const previousStatus = currentTicket.status;
    let targetStatus = status || previousStatus;

    const updatePayload = {};

    if (action === 'accept') {
      targetStatus = 'accepted';
      updatePayload.status = 'accepted';
      updatePayload.assigned_technician_id = auth.userId;
      updatePayload.accepted_at = new Date().toISOString();
    } else if (action === 'resolve') {
      targetStatus = 'resolved';
      updatePayload.status = 'resolved';
      updatePayload.resolved_at = new Date().toISOString();
    } else if (status) {
      updatePayload.status = status;
    }

    const { data: updatedTicket, error } = await supabase
      .from('support_tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select('*, creator:users!support_tickets_created_by_fkey(id, name)')
      .single();

    if (error) throw error;

    // 2. Insert audit history log
    const defaultRemark = action === 'accept'
      ? 'Technician accepted support ticket.'
      : targetStatus === 'need_visiting'
      ? 'Physical site visit required after customer consultation.'
      : targetStatus === 'visited_pending'
      ? 'Site visited; pending additional parts/testing.'
      : `Ticket status updated to ${targetStatus}.`;

    await supabase.from('support_ticket_history').insert({
      ticket_id: ticketId,
      actor_id: auth.userId,
      actor_role: auth.userRole,
      previous_status: previousStatus,
      new_status: targetStatus,
      remarks: remarks || defaultRemark
    });

    // 3. Notify ticket owner
    if (updatedTicket.creator?.id) {
      await supabase.from('notifications').insert({
        user_id: updatedTicket.creator.id,
        title: `Ticket Status Updated: ${targetStatus.replace('_', ' ').toUpperCase()}`,
        message: `Your ticket "${updatedTicket.title}" is now ${targetStatus.replace('_', ' ')}. ${remarks ? `Reason: ${remarks}` : ''}`,
        type: 'ticket_update'
      });
    }

    logger.info('Updated support ticket status and recorded history log', {
      ticketId,
      previousStatus,
      newStatus: targetStatus,
      actorId: auth.userId
    });

    return NextResponse.json(updatedTicket);
  } catch (error) {
    logger.error('Failed to update support ticket', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
