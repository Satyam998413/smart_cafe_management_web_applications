import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

// Shared -100..0 dBm -> label scale for both mobile-side signal
// readings taken during pairing (device<->mobile BLE, mobile<->router
// Wi-Fi). The third reading shown in the app, device<->router, isn't a
// mobile measurement at all — it's the hardware's own report via
// POST /api/devices/heartbeat once it's online, so it isn't touched here.
function signalLabel(rssi) {
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -65) return 'Good';
  if (rssi >= -80) return 'Fair';
  return 'Weak / Poor';
}

// GET /api/technician/device-pairing?orgId=...
export async function GET(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const targetOrgId = searchParams.get('orgId') || auth.orgId;

    if (!targetOrgId) {
      return NextResponse.json({ message: 'orgId is required' }, { status: 400 });
    }

    const { data: devices } = await supabase.from('devices').select('*, space:spaces(name)').eq('org_id', targetOrgId);
    const { data: locks } = await supabase.from('smart_locks').select('*, space:spaces(name)').eq('org_id', targetOrgId);
    const { data: punching } = await supabase.from('punching_devices').select('*').eq('org_id', targetOrgId);

    return NextResponse.json({
      controllers: devices || [],
      locks: locks || [],
      punchingDevices: punching || []
    });
  } catch (error) {
    logger.error('Failed to fetch device pairing data', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST /api/technician/device-pairing — confirms a one-time Wi-Fi + BLE
// pairing for a device and records the two mobile-side signal readings the
// technician app takes at that moment:
//   - mobileBleRssi:  how well the PHONE hears the DEVICE over Bluetooth
//   - mobileWifiRssi: how well the PHONE hears the ROUTER over Wi-Fi
// (The third reading the app shows, device<->router, comes later from the
// device's own heartbeat — see /api/devices/heartbeat — not from here.)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { deviceType, deviceId, wifiSsid, bluetoothMac, mobileBleRssi, mobileWifiRssi, spaceId } = body;

    if (!deviceType || !deviceId) {
      return NextResponse.json({ message: 'deviceType and deviceId are required' }, { status: 400 });
    }

    const bleRssi = Number.isFinite(mobileBleRssi) ? parseInt(mobileBleRssi, 10) : null;
    const wifiRssi = Number.isFinite(mobileWifiRssi) ? parseInt(mobileWifiRssi, 10) : null;

    const updateData = {
      wifi_ssid: wifiSsid || null,
      bluetooth_mac: bluetoothMac || null,
      mobile_ble_rssi: bleRssi,
      mobile_wifi_rssi: wifiRssi,
      pairing_status: 'paired'
    };

    if (spaceId) updateData.space_id = spaceId;

    let targetTable = 'devices';
    if (deviceType === 'lock') targetTable = 'smart_locks';
    if (deviceType === 'punching') targetTable = 'punching_devices';

    const { data, error } = await supabase
      .from(targetTable)
      .update(updateData)
      .eq('id', deviceId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Technician paired hardware device', {
      deviceType,
      deviceId,
      mobileBleRssi: bleRssi,
      mobileWifiRssi: wifiRssi,
      technicianId: auth.userId
    });
    return NextResponse.json({
      message: 'Device paired successfully via Wi-Fi/Bluetooth',
      mobileBleSignal: bleRssi !== null ? signalLabel(bleRssi) : null,
      mobileWifiSignal: wifiRssi !== null ? signalLabel(wifiRssi) : null,
      device: data
    });
  } catch (error) {
    logger.error('Failed to pair device', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
