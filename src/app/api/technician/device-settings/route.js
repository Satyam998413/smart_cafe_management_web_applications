import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { tableForCategory } from '@/lib/deviceAuth.js';

const ALLOWED_ROLES = ['master_admin', 'technician'];

// PATCH /api/technician/device-settings — saves how the backend should
// reach an already-paired device: its transport (deviceType: 'api' or
// 'mqtt'), the IP address/domain URL that transport talks to, and any
// protocol-specific extras (settings, e.g. an MQTT topic prefix or an API
// auth header name). Separate from device-pairing's POST, which only
// records the one-time Wi-Fi/BLE handshake and its signal readings.
export async function PATCH(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;
  if (!auth.isMasterAdmin && !ALLOWED_ROLES.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { category, deviceId, deviceType, endpointUrl, settings } = body;

    const table = tableForCategory(category);
    if (!table || !deviceId) {
      return NextResponse.json(
        { message: 'A valid category (controller/lock/punching) and deviceId are required' },
        { status: 400 }
      );
    }
    if (deviceType !== undefined && !['api', 'mqtt'].includes(deviceType)) {
      return NextResponse.json({ message: 'deviceType must be "api" or "mqtt"' }, { status: 400 });
    }
    if (settings !== undefined && (typeof settings !== 'object' || settings === null || Array.isArray(settings))) {
      return NextResponse.json({ message: 'settings must be a JSON object' }, { status: 400 });
    }

    const updateData = {};
    // Column is transport_type, not device_type — punching_devices already
    // has an unrelated device_type column (rfid_reader/thumbprint_scanner/
    // etc, see migration 0015's own comment). The request body still uses
    // deviceType as its external name; it just maps to a different column.
    if (deviceType !== undefined) updateData.transport_type = deviceType;
    if (endpointUrl !== undefined) updateData.endpoint_url = endpointUrl;
    if (settings !== undefined) updateData.settings = settings;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase.from(table).update(updateData).eq('id', deviceId).select('*').single();
    if (error) throw error;

    logger.info('Technician saved device settings', { category, deviceId, deviceType, technicianId: auth.userId });
    return NextResponse.json({ message: 'Device settings saved', device: data });
  } catch (error) {
    logger.error('Failed to save device settings', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
