import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// GET /api/leaves (List leave requests)
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;
    const targetUserId = searchParams.get('userId');

    let query = supabase
      .from('leave_requests')
      .select('*, user:users(name, email, role)')
      .eq('org_id', targetOrgId)
      .order('created_at', { ascending: false });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;
    if (error && error.code !== 'PGRST205') throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch leave requests', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/leaves (Apply for leave)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { leaveType, startDate, endDate, reason } = body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json({ message: 'All fields (leaveType, startDate, endDate, reason) are required' }, { status: 400 });
    }

    const payload = {
      org_id: auth.orgId,
      user_id: auth.userId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim(),
      manager_status: 'pending',
      owner_status: 'pending',
      final_status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('leave_requests')
      .insert(payload)
      .select('*, user:users(name, email, role)')
      .single();

    if (error && error.code !== 'PGRST205') throw error;

    logger.info('Leave request created', { userId: auth.userId, leaveType, startDate, endDate });
    return NextResponse.json(data || { ...payload, id: `leave_${Date.now()}` }, { status: 201 });
  } catch (error) {
    logger.error('Failed to apply for leave', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}

// PATCH /api/leaves (Manager or Owner Approval/Rejection)
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { leaveId, action, role } = body; // action: 'approved' | 'rejected', role: 'manager' | 'owner'

    if (!leaveId || !action) {
      return NextResponse.json({ message: 'leaveId and action are required' }, { status: 400 });
    }

    const isManager = role === 'manager' || auth.userRole === 'manager';
    const isOwner = role === 'owner' || auth.userRole === 'owner';

    const updates = {
      approved_by_user_id: auth.userId,
    };

    if (isManager) updates.manager_status = action;
    if (isOwner) updates.owner_status = action;

    // Dual/Single Approval Logic: if either manager or owner approves (or if action is rejected)
    if (action === 'rejected') {
      updates.final_status = 'rejected';
    } else if (action === 'approved') {
      updates.final_status = 'approved';
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update(updates)
      .eq('id', leaveId)
      .select('*, user:users(name, email, role)')
      .single();

    if (error && error.code !== 'PGRST205') throw error;

    logger.info('Leave request updated', { leaveId, action, updatedBy: auth.userId });
    return NextResponse.json(data || { id: leaveId, ...updates }, { status: 200 });
  } catch (error) {
    logger.error('Failed to update leave request', { error: error.message });
    return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
  }
}
