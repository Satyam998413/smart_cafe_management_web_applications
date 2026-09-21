import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth, optionalAuth } from '@/lib/auth.js';

// GET /api/punching (Fetch attendance logs)
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, user:users(name, email, role), device:punching_devices(device_name, device_type)')
      .eq('org_id', targetOrgId)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error && error.code !== 'PGRST205') throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch attendance logs', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/punching (Device Webhook Receiver & Manual Mobile App Punch Endpoint)
export async function POST(request) {
  const auth = optionalAuth(request);

  try {
    const body = await request.json();
    const { serialNumber, rfidCardNumber, userId, verificationMethod, punchType, remarks, orgId, lat, lng, photoUrl } = body;

    let targetOrgId = orgId || auth.orgId;
    let targetUserId = userId || auth.userId;
    let matchedDeviceId = null;
    let method = verificationMethod || (photoUrl ? 'app_gps_camera' : 'rfid');

    // Hardware device punch lookup via RFID Card or Device Serial
    if (serialNumber) {
      const { data: device } = await supabase
        .from('punching_devices')
        .select('*')
        .eq('serial_number', serialNumber)
        .maybeSingle();

      if (device) {
        targetOrgId = device.org_id;
        matchedDeviceId = device.id;
        method = device.device_type === 'face_recognition_cam' ? 'face_recognition' : device.device_type === 'thumbprint_scanner' ? 'thumbprint' : 'rfid';
      }
    }

    if (rfidCardNumber && !targetUserId) {
      const { data: rfidCard } = await supabase
        .from('rfid_cards')
        .select('assigned_to_user_id')
        .eq('card_number', rfidCardNumber)
        .maybeSingle();

      if (rfidCard?.assigned_to_user_id) {
        targetUserId = rfidCard.assigned_to_user_id;
      }
    }

    if (!targetOrgId || !targetUserId) {
      return NextResponse.json(
        { message: 'Could not resolve organization or user context for attendance log' },
        { status: 400 }
      );
    }

    // Auto-determine punch_type (in vs out) if not specified
    let finalPunchType = punchType;
    if (!finalPunchType) {
      const { data: lastPunch } = await supabase
        .from('attendance_logs')
        .select('punch_type')
        .eq('user_id', targetUserId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      finalPunchType = lastPunch?.punch_type === 'in' ? 'out' : 'in';
    }

    const now = new Date();
    const currentTimeStr = now.toTimeString().substring(0, 8); // e.g. "09:45:00"

    // Fetch user's shift settings
    const { data: shift } = await supabase
      .from('staff_shifts')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    const maxInTimeStr = shift?.max_in_time || '09:30:00';
    const minExitTimeStr = shift?.min_exit_time || '18:00:00';

    // Check if user is on approved leave today
    const todayDateStr = now.toISOString().substring(0, 10);
    const { data: approvedLeaves } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('final_status', 'approved')
      .lte('start_date', todayDateStr)
      .gte('end_date', todayDateStr);

    const isOnApprovedLeave = approvedLeaves && approvedLeaves.length > 0;

    let isLate = false;
    let lateMinutes = 0;
    let overtimeMinutes = 0;

    // If punch type is 'in' and NOT on approved leave, compare with max_in_time
    if (finalPunchType === 'in' && !isOnApprovedLeave) {
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [maxH, maxM] = maxInTimeStr.split(':').map(Number);

      const currTotalM = currH * 60 + currM;
      const maxTotalM = maxH * 60 + maxM;

      if (currTotalM > maxTotalM) {
        isLate = true;
        lateMinutes = currTotalM - maxTotalM;
      }
    }

    // If punch type is 'out', calculate overtime if past min_exit_time
    if (finalPunchType === 'out') {
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [minH, minM] = minExitTimeStr.split(':').map(Number);

      const currTotalM = currH * 60 + currM;
      const minTotalM = minH * 60 + minM;

      if (currTotalM > minTotalM) {
        overtimeMinutes = currTotalM - minTotalM;
      }
    }

    const payload = {
      org_id: targetOrgId,
      user_id: targetUserId,
      device_id: matchedDeviceId,
      verification_method: method,
      punch_type: finalPunchType,
      timestamp: now.toISOString(),
      lat: lat || null,
      lng: lng || null,
      photo_url: photoUrl || null,
      is_late: isLate,
      late_minutes: lateMinutes,
      overtime_minutes: overtimeMinutes,
      remarks: remarks || (isLate ? `Punched IN late by ${lateMinutes} minutes` : `Punched ${finalPunchType.toUpperCase()} via ${method}`)
    };

    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert(payload)
      .select('*, user:users(name, email, role)')
      .single();

    if (error && error.code !== 'PGRST205') throw error;

    logger.info('Punch attendance recorded', { userId: targetUserId, punchType: finalPunchType, isLate, lateMinutes });
    return NextResponse.json(log || { ...payload, id: `log_${Date.now()}` }, { status: 201 });
  } catch (error) {
    logger.error('Failed to record attendance punch', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
