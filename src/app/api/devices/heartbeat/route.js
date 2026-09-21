import { NextResponse } from 'next/server';
import logger from '@/lib/logger.js';
import { requireDeviceAuth } from '@/lib/deviceAuth.js';
import { recordHeartbeat } from '@/lib/deviceEvents.js';

// POST /api/devices/heartbeat — called by the physical device itself
// (Authorization: Bearer <long-lived device access token>, not a user
// session) roughly every 30s as a generic liveness ping. wifiRssi is
// optional: present only on the technician pairing flow's one-off "how well
// do I hear the router" report; absent on routine heartbeats. Either way,
// last_heartbeat_at is always stamped — that's what every device-listing UI
// uses to show online (green) vs offline/gray (see src/lib/deviceStatus.js).
export async function POST(request) {
  const auth = await requireDeviceAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const wifiRssi = Number.isFinite(body.wifiRssi) ? Math.trunc(body.wifiRssi) : null;

    const device = await recordHeartbeat({
      table: auth.table,
      deviceId: auth.deviceId,
      category: auth.category,
      wifiRssi
    });

    return NextResponse.json({ message: 'Heartbeat recorded', lastHeartbeatAt: device.last_heartbeat_at });
  } catch (error) {
    logger.error('Failed to record device heartbeat', { error: error.message, deviceId: auth.deviceId });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
