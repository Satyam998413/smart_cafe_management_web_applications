import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireDeviceAuth } from '@/lib/deviceAuth.js';

// POST /api/devices/heartbeat — called by the physical device itself
// (Authorization: Bearer <long-lived device access token>, not a user
// session), reporting its own Wi-Fi signal to the router. This is the one
// reading in the technician provisioning flow that isn't a phone-side
// simulation: only the device's own radio can say how well IT hears the
// router, which is what the app's third signal indicator shows.
export async function POST(request) {
  const auth = await requireDeviceAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const wifiRssi = Number.isFinite(body.wifiRssi) ? Math.trunc(body.wifiRssi) : null;
    if (wifiRssi === null) {
      return NextResponse.json({ message: 'wifiRssi (integer dBm) is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from(auth.table)
      .update({ device_wifi_rssi: wifiRssi, device_wifi_rssi_reported_at: new Date().toISOString() })
      .eq('id', auth.deviceId);
    if (error) throw error;

    return NextResponse.json({ message: 'Heartbeat recorded' });
  } catch (error) {
    logger.error('Failed to record device heartbeat', { error: error.message, deviceId: auth.deviceId });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
