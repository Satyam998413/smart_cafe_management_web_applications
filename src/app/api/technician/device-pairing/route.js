import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

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

// POST /api/technician/device-pairing (Pair hardware via Wi-Fi/Bluetooth with RSSI signal strength & space ID)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { deviceType, deviceId, wifiSsid, bluetoothMac, rssiSignalStrength, spaceId } = body;

    if (!deviceType || !deviceId) {
      return NextResponse.json({ message: 'deviceType and deviceId are required' }, { status: 400 });
    }

    // Determine signal quality label
    const rssi = parseInt(rssiSignalStrength || -55, 10);
    let signalLabel = 'Excellent';
    if (rssi < -80) signalLabel = 'Weak / Poor';
    else if (rssi < -65) signalLabel = 'Fair';
    else if (rssi < -50) signalLabel = 'Good';

    const updateData = {
      wifi_ssid: wifiSsid || 'SmartCafe-Staff-WiFi',
      bluetooth_mac: bluetoothMac || 'AA:BB:CC:DD:EE:FF',
      rssi_signal_strength: rssi,
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

    logger.info('Technician paired hardware device', { deviceType, deviceId, rssi, signalLabel, technicianId: auth.userId });
    return NextResponse.json({
      message: 'Device paired successfully via Wi-Fi/Bluetooth',
      signalQuality: signalLabel,
      device: data
    });
  } catch (error) {
    logger.error('Failed to pair device', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
