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

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Failed to fetch attendance logs', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/punching (Device Webhook Receiver & Manual Punch Endpoint)
export async function POST(request) {
  // Support both hardware webhooks (with serialNumber/apiKey) and authenticated user requests
  const auth = optionalAuth(request);

  try {
    const body = await request.json();
    const { serialNumber, rfidCardNumber, userId, verificationMethod, punchType, remarks, orgId } = body;

    let targetOrgId = orgId || auth.orgId;
    let targetUserId = userId || auth.userId;
    let matchedDeviceId = null;
    let method = verificationMethod || 'rfid';

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

    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert({
        org_id: targetOrgId,
        user_id: targetUserId,
        device_id: matchedDeviceId,
        verification_method: method,
        punch_type: finalPunchType,
        timestamp: new Date().toISOString(),
        remarks: remarks || `Punched ${finalPunchType.toUpperCase()} via ${method}`
      })
      .select('*, user:users(name, email)')
      .single();

    if (error) throw error;

    logger.info('Punch attendance recorded', { userId: targetUserId, punchType: finalPunchType, method });
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    logger.error('Failed to record attendance punch', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
