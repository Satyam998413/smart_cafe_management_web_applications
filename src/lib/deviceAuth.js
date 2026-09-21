import { NextResponse } from 'next/server';
import { tableForCategory, hashDeviceToken, mintDeviceToken, verifyDeviceToken } from './deviceAuthCore.js';

// Re-exported for every existing caller of this module (route handlers) —
// the actual logic lives in deviceAuthCore.js, which has zero 'next/server'
// import so src/lib/mqttServer.js (imported at server.js's top level,
// before Next's loader is active) can use verifyDeviceToken without
// dragging next/server into that boot-time import chain. See
// deviceAuthCore.js's header comment for the full story.
export { tableForCategory, hashDeviceToken, mintDeviceToken, verifyDeviceToken };

/**
 * Authenticates an inbound HTTP request from a physical device (e.g. a
 * heartbeat), using the token mintDeviceToken issued. Thin wrapper around
 * verifyDeviceToken that extracts the Bearer header and translates a null
 * result into the right NextResponse status (401 missing vs 403 rejected).
 *
 * Returns { error: NextResponse } on failure, or { deviceId, orgId,
 * category, table } on success.
 */
export async function requireDeviceAuth(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return { error: NextResponse.json({ message: 'Device access token required' }, { status: 401 }) };
  }

  if (!process.env.DEVICE_JWT_SECRET) {
    return { error: NextResponse.json({ message: 'Server misconfigured: DEVICE_JWT_SECRET not set' }, { status: 500 }) };
  }

  const auth = await verifyDeviceToken(token);
  if (!auth) {
    return { error: NextResponse.json({ message: 'Invalid or revoked device token' }, { status: 403 }) };
  }

  return auth;
}
